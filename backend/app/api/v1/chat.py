"""AI chat endpoints for parent and admin assistants."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.ai_context import build_admin_context, build_parent_context
from app.core.ai_service import (
    ADMIN_SYSTEM_PROMPT,
    PARENT_SYSTEM_PROMPT,
    chat_with_gemini,
)
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.conversation import Conversation, Message, MessageRole
from app.models.user import User, UserRole

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    conversation_id: uuid.UUID | None = None


class ConversationItem(BaseModel):
    id: uuid.UUID
    title: str
    created_at: str
    updated_at: str


class MessageItem(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: str


class ConversationDetail(BaseModel):
    id: uuid.UUID
    title: str
    messages: list[MessageItem]


class ChatResponse(BaseModel):
    conversation_id: str
    response: str


@router.get("/conversations")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationItem]:
    """List user's conversations."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(20)
    )
    convos = result.scalars().all()
    return [
        ConversationItem(
            id=c.id,
            title=c.title,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in convos
    ]


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetail:
    """Get a conversation with messages."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    convo = result.scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı")

    return ConversationDetail(
        id=convo.id,
        title=convo.title,
        messages=[
            MessageItem(
                id=m.id,
                role=m.role.value,
                content=m.content,
                created_at=m.created_at.isoformat(),
            )
            for m in convo.messages
        ],
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a conversation."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    convo = result.scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı")
    await db.delete(convo)
    await db.commit()


@router.post("/send")
async def send_message(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Send a message and get AI response."""
    # Validate role
    if current_user.role not in (UserRole.PARENT, UserRole.ADMIN):
        raise HTTPException(
            status_code=403,
            detail="AI asistan sadece veli ve yönetici portalında kullanılabilir",
        )

    # Get or create conversation
    if data.conversation_id:
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(
                Conversation.id == data.conversation_id,
                Conversation.user_id == current_user.id,
            )
        )
        convo = result.scalar_one_or_none()
        if not convo:
            raise HTTPException(status_code=404, detail="Konuşma bulunamadı")
    else:
        # Create new conversation
        title = data.message[:50] + ("..." if len(data.message) > 50 else "")
        convo = Conversation(user_id=current_user.id, title=title)
        db.add(convo)
        await db.flush()

    # Build context based on role
    if current_user.role == UserRole.PARENT:
        context = await build_parent_context(current_user, db)
        system_prompt = PARENT_SYSTEM_PROMPT
    else:
        context = await build_admin_context(current_user, db)
        system_prompt = ADMIN_SYSTEM_PROMPT

    # Get conversation history
    if data.conversation_id:
        past_messages = [
            {"role": m.role.value, "content": m.content} for m in convo.messages
        ]
    else:
        past_messages = []

    # Call Gemini
    try:
        ai_response = await chat_with_gemini(
            system_prompt=system_prompt,
            context=context,
            messages=past_messages,
            user_message=data.message,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI yanıt veremedi: {e!s}",
        ) from e

    # Save messages
    user_msg = Message(
        conversation_id=convo.id,
        role=MessageRole.USER,
        content=data.message,
    )
    assistant_msg = Message(
        conversation_id=convo.id,
        role=MessageRole.ASSISTANT,
        content=ai_response,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    await db.commit()

    return ChatResponse(
        conversation_id=str(convo.id),
        response=ai_response,
    )
