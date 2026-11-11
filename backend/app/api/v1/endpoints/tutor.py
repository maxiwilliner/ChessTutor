from fastapi import APIRouter, HTTPException
from backend.app.models.diagnosis import PlayerDiagnosisSummary
from backend.app.models.tutor import TutorPedagogicalReport
from backend.app.modules.tutor.llm_service import generate_tutor_report
from backend.app.api.v1.endpoints.analysis import _LATEST_ANALYSIS

router = APIRouter(prefix="/tutor", tags=["Tutor"])


@router.post("/diagnosis", response_model=TutorPedagogicalReport)
async def generate_diagnosis(summary: PlayerDiagnosisSummary):
    """
    Generates a personalized pedagogical report from an existing PlayerDiagnosisSummary JSON.
    """
    return await generate_tutor_report(summary)


@router.get("/report/{username}", response_model=TutorPedagogicalReport)
async def get_report_by_username(username: str):
    """
    Returns the pedagogical diagnosis for the user's latest analysis.
    """
    analysis = _LATEST_ANALYSIS.get(username.lower())
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=f"No recent analysis found for '{username}'. Please run an analysis stream first."
        )
    return await generate_tutor_report(analysis["summary"])

