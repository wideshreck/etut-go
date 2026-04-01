from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.parent import router as parent_router
from app.api.v1.student import router as student_router
from app.api.v1.superadmin import router as superadmin_router
from app.api.v1.teacher import router as teacher_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(chat_router)
router.include_router(notifications_router)
router.include_router(superadmin_router)
router.include_router(admin_router)
router.include_router(teacher_router)
router.include_router(student_router)
router.include_router(parent_router)
