"""
app/api/router.py

Central API router that aggregates all module routers under /api/v1.
To add a new module: import its router here and call include_router().
"""
from fastapi import APIRouter

from app.modules.farmers.router    import router as farmers_router
from app.modules.batches.router    import router as batches_router
from app.modules.routing.router    import router as routing_router
from app.modules.calculator.router import router as calculator_router
from app.modules.mrv.router        import router as mrv_router
from app.modules.operators.router  import router as operators_router
from app.modules.facilities.router import router as facilities_router

# Top-level API router — all module routers mount under this prefix
api_router = APIRouter(prefix="/api/v1")

api_router.include_router(farmers_router)
api_router.include_router(batches_router)
api_router.include_router(routing_router)
api_router.include_router(calculator_router)
api_router.include_router(mrv_router)
api_router.include_router(operators_router)
api_router.include_router(facilities_router)