from db.client import DatabaseClient
from models.schemas import CatalogItemResponse


class ProductNotFoundError(LookupError):
    pass


class FavouriteService:
    def __init__(self, db: DatabaseClient):
        self.db = db

    def add(self, user_email: str, product_id: int) -> None:
        """Idempotent: favouriting an existing Favourite changes nothing."""
        if self.db.get_catalog_item_by_id(product_id) is None:
            raise ProductNotFoundError(f"Product {product_id} not found")
        self.db.add_favourite(user_email, product_id)

    def remove(self, user_email: str, product_id: int) -> None:
        """Idempotent: removing a Favourite that is not there succeeds."""
        self.db.remove_favourite(user_email, product_id)

    def list(self, user_email: str) -> list[CatalogItemResponse]:
        """The shopper's Favourite Products, most recently added first."""
        return [
            CatalogItemResponse(
                id=item.id,
                name=item.name,
                description=item.description,
                price=item.price,
                picture_uri=item.picture_uri,
                catalog_brand_id=item.catalog_brand_id,
                catalog_type_id=item.catalog_type_id,
                brand_name=item.brand_name,
                type_name=item.type_name,
            )
            for item in self.db.list_favourite_items(user_email)
        ]
