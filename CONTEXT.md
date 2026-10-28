# eShop

A small online store where shoppers browse a catalogue, fill a basket and check out.

## Language

**Product**:
An item in the catalogue that a shopper can view, favourite or add to a basket.
_Avoid_: Catalog item (code-level name only), SKU

**Shopper**:
A person using the store, either anonymous or signed in.
_Avoid_: Visitor, customer, user

**Signed-in shopper**:
A **Shopper** identified by their email address.
_Avoid_: Member, account holder

**Favourite**:
A **Product** a **Signed-in shopper** has marked as one they like.
_Avoid_: Wishlist, like, bookmark, saved item

## Relationships

- A **Signed-in shopper** has zero or more **Favourites**
- A **Favourite** refers to exactly one **Product**
- An anonymous **Shopper** has no **Favourites**

## Example dialogue

> **Dev:** "When an anonymous **Shopper** taps the heart on a **Product**, do we store a **Favourite** under their basket id?"
> **Domain expert:** "No - only a **Signed-in shopper** can have **Favourites**. We ask them to sign in first."

## Flagged ambiguities

- "visitor" was used for any person on the site - resolved: the term is **Shopper**, and only a **Signed-in shopper** can have **Favourites**.
