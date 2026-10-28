from fastapi import APIRouter, Depends, HTTPException, status

from dependencies import get_favourite_service, require_authenticated_user
from models.schemas import CatalogItemResponse
from services.favourite_service import FavouriteService, ProductNotFoundError

router = APIRouter(prefix="/api/favourites", tags=["favourites"])


@router.get("", response_model=list[CatalogItemResponse])
def list_favourites(
    user_email: str = Depends(require_authenticated_user),
    service: FavouriteService = Depends(get_favourite_service),
):
    return service.list(user_email)


@router.put("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_favourite(
    product_id: int,
    user_email: str = Depends(require_authenticated_user),
    service: FavouriteService = Depends(get_favourite_service),
):
    try:
        service.add(user_email, product_id)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favourite(
    product_id: int,
    user_email: str = Depends(require_authenticated_user),
    service: FavouriteService = Depends(get_favourite_service),
):
    service.remove(user_email, product_id)
