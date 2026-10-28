import sqlite3
from datetime import datetime, timedelta, timezone

from config import settings
from db.seed import DEMO_EMAIL
from tests.conftest import login

UNKNOWN_PRODUCT_ID = 999_999


def favourite_ids(client, headers):
    response = client.get("/api/favourites", headers=headers)
    assert response.status_code == 200, response.text
    return [product["id"] for product in response.json()]


def register(client, email, password="Pass@word1"):
    response = client.post(
        "/api/auth/register", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_favourite_a_product_then_list_and_remove_it(client, demo_headers):
    assert favourite_ids(client, demo_headers) == []

    added = client.put("/api/favourites/3", headers=demo_headers)
    assert added.status_code == 204
    assert favourite_ids(client, demo_headers) == [3]

    removed = client.delete("/api/favourites/3", headers=demo_headers)
    assert removed.status_code == 204
    assert favourite_ids(client, demo_headers) == []


def test_favouriting_twice_keeps_one_favourite(client, demo_headers):
    assert client.put("/api/favourites/3", headers=demo_headers).status_code == 204
    assert client.put("/api/favourites/3", headers=demo_headers).status_code == 204

    assert favourite_ids(client, demo_headers) == [3]


def test_removing_a_favourite_that_does_not_exist_succeeds(client, demo_headers):
    assert client.delete("/api/favourites/3", headers=demo_headers).status_code == 204
    assert client.delete("/api/favourites/3", headers=demo_headers).status_code == 204


def test_favouriting_an_unknown_product_is_a_404(client, demo_headers):
    response = client.put(f"/api/favourites/{UNKNOWN_PRODUCT_ID}", headers=demo_headers)

    assert response.status_code == 404
    assert favourite_ids(client, demo_headers) == []


def test_removing_an_unknown_product_succeeds(client, demo_headers):
    response = client.delete(
        f"/api/favourites/{UNKNOWN_PRODUCT_ID}", headers=demo_headers
    )

    assert response.status_code == 204


def test_favourites_are_listed_newest_first(client, demo_headers):
    for product_id in (3, 1, 2):
        client.put(f"/api/favourites/{product_id}", headers=demo_headers)

    assert favourite_ids(client, demo_headers) == [2, 1, 3]


def test_favouriting_again_does_not_move_it_to_the_top(client, demo_headers):
    for product_id in (3, 1):
        client.put(f"/api/favourites/{product_id}", headers=demo_headers)
    client.put("/api/favourites/3", headers=demo_headers)

    assert favourite_ids(client, demo_headers) == [1, 3]


def test_the_list_uses_the_catalogue_product_shape_with_current_details(
    client, demo_headers
):
    client.put("/api/favourites/3", headers=demo_headers)
    catalogue_product = next(
        item
        for item in client.get("/api/catalog/items").json()["items"]
        if item["id"] == 3
    )

    (listed,) = client.get("/api/favourites", headers=demo_headers).json()
    assert listed == catalogue_product

    with sqlite3.connect(settings.database_path) as conn:
        conn.execute("UPDATE catalog_items SET price = 12.34 WHERE id = 3")

    (relisted,) = client.get("/api/favourites", headers=demo_headers).json()
    assert relisted["price"] == 12.34


def test_two_shoppers_cannot_see_or_change_each_others_favourites(
    client, demo_headers
):
    other_headers = register(client, "other@example.com")
    client.put("/api/favourites/3", headers=demo_headers)
    client.put("/api/favourites/4", headers=other_headers)

    assert favourite_ids(client, demo_headers) == [3]
    assert favourite_ids(client, other_headers) == [4]

    client.delete("/api/favourites/4", headers=demo_headers)
    assert favourite_ids(client, other_headers) == [4]


def test_the_same_product_can_be_a_favourite_of_two_shoppers(client, demo_headers):
    other_headers = register(client, "other@example.com")

    assert client.put("/api/favourites/3", headers=demo_headers).status_code == 204
    assert client.put("/api/favourites/3", headers=other_headers).status_code == 204

    assert favourite_ids(client, demo_headers) == [3]
    assert favourite_ids(client, other_headers) == [3]


def test_favourites_survive_signing_out_and_back_in(client, demo_headers):
    client.put("/api/favourites/3", headers=demo_headers)

    signed_in_again = login(client)

    assert favourite_ids(client, signed_in_again) == [3]


def test_anonymous_shoppers_get_a_401(client, anon_headers):
    for headers in ({}, anon_headers):
        assert client.get("/api/favourites", headers=headers).status_code == 401
        assert client.put("/api/favourites/3", headers=headers).status_code == 401
        assert client.delete("/api/favourites/3", headers=headers).status_code == 401


def test_an_email_sent_as_a_basket_id_cannot_reach_anyones_favourites(
    client, demo_headers
):
    client.put("/api/favourites/3", headers=demo_headers)
    attack = {"X-Basket-Id": DEMO_EMAIL}

    assert client.get("/api/favourites", headers=attack).status_code == 401
    assert client.put("/api/favourites/4", headers=attack).status_code == 401
    assert client.delete("/api/favourites/3", headers=attack).status_code == 401

    assert favourite_ids(client, demo_headers) == [3]


def test_a_malformed_or_tampered_token_is_refused(client, demo_headers):
    client.put("/api/favourites/3", headers=demo_headers)
    tampered = {"Authorization": demo_headers["Authorization"] + "x"}

    assert client.get("/api/favourites", headers=tampered).status_code == 401
    assert client.put("/api/favourites/4", headers=tampered).status_code == 401
    assert client.delete("/api/favourites/3", headers=tampered).status_code == 401
    assert (
        client.get(
            "/api/favourites", headers={"Authorization": "Token abc"}
        ).status_code
        == 401
    )

    assert favourite_ids(client, demo_headers) == [3]


def test_an_expired_token_is_refused(client, demo_headers):
    from jose import jwt

    expired = jwt.encode(
        {"sub": DEMO_EMAIL, "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    response = client.get(
        "/api/favourites", headers={"Authorization": f"Bearer {expired}"}
    )

    assert response.status_code == 401


def test_the_time_a_favourite_was_added_is_utc(client, demo_headers):
    before = datetime.now(timezone.utc)
    client.put("/api/favourites/3", headers=demo_headers)
    after = datetime.now(timezone.utc)

    with sqlite3.connect(settings.database_path) as conn:
        (stored,) = conn.execute("SELECT added_at FROM favourites").fetchone()

    added = datetime.fromisoformat(stored)
    assert added.utcoffset() == timedelta(0)
    assert before <= added <= after
