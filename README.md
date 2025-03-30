# Meal Mancer Backend

## SQL API Documentation

**Base URL**: `https://meal-mancer-api-q3zh9.ondigitalocean.app`

## POST

### Login 

**Endpoint**: `/v1/login`

**Content-Type**: `application/json`

**Body**: 
```json
{
  "email": "{email address}",
  "password": "{password}"
}
```

**Response**: `JSON`

- **200** Ok
```json
{
  "message": "Successful Login!",
  "role": "{admin | general}",
  "tokens": "{number of tokens left}",
  "httpRequests": "{number of requests made}",
  "expiresAt": "{session expiration time}"
}
```

- **401** Unauthorized
```json
{
  "message": "Invalid email or password"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```

---

### Signup

**Endpoint**: `/v1/signup`

**Content-Type**: `application/json`

**Body**: 
```json
{
  "email": "{email address}",
  "password": "{password}"
}
```
**Response**: `JSON`

- **200** Ok
```json
{
  "message": "Successful Login!",
  "role": "{admin | general}",
  "tokens": "{number of tokens left}",
  "httpRequests": "{number of requests made}",
  "expiresAt": "{session expiration time}"
}
```

- **400** Bad Request
```json
{
  "message": "Email already in use"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```

---

### Logout

**Endpoint**: `/v1/logout`

**Content-Type**: `application/json`

**Body**: `None`


**Response**: `JSON`

- **200** Ok
```json
{
  "message": "Successful Logout!"
}
```

---

### Add Favourite

**Endpoint**: `/v1/favourites`

**Content-Type**: `None`

**Body**: 
```json
{
  "recipe" : {
    "title": "{recipe title}",
    "ingredients": ["{ingredient}", "{ingredient}", ...],
    "directions": ["{direction}", "{direction}", ...]
  }
}
```

**Response**: `JSON`

- **200** Ok
```json
{
  "message": "New favourite recipe!"
}
```

- **401** Unauthorized
```json
{
  "message": "Access Denied: Invalid Token"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```

---

## GET

### Generate Recipe 

**Endpoint**: `/v1/generate/?ingredients={ingredients}`

**Content-Type**: `None`

**Body**: `None`

**Response**: `JSON`

- **200** Ok
```json
{
  "title": "{recipe title}",
  "ingredients": ["{ingredient}", "{ingredient}", ...],
  "directions": ["{direction}", "{direction}", ...]
}
```

- **400** Bad Request
```json
{
  "message" : "You've run out of coins for the Meal Mancer!"
}
```

- **401** Unauthorized
```json
{
  "message": "Access Denied: Invalid Token"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```

---

### User List

**Endpoint**: `/v1/users`

**Content-Type**: `None`

**Body**: `None`

**Response**: `JSON`

- **200** Ok
```json
[
  {
    "user_id": "{user id}",
    "email": "{email address}",
    "tokens": "{number of tokens left}",
    "httpRequests": "{number of requests made}"
  },
  ...
]
```

- **401** Unauthorized
```json
{
  "message": "Access Denied: Invalid Token"
}
```

- **401** Unauthorized
```json
{
  "message": "This magic is not for you!"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```

---

### API Status

**Endpoint**: `/v1/apiStats`

**Content-Type**: `None`

**Body**: `None`

**Response**: `JSON`

- **200** Ok
```json
[
  {
    "method": "{GET | POST | DELETE | ...}",
    "endpoint": "{API endpoint}",
    "requests": "{number of requests made}"
  },
  ...
]
```

- **401** Unauthorized
```json
{
  "message": "Access Denied: Invalid Token"
}
```

- **401** Unauthorized
```json
{
  "message": "This magic is not for you!"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```

---

### Favourites

**Endpoint**: `/v1/favourites`

**Content-Type**: `None`

**Body**: `None`

**Response**: `JSON`

- **200** Ok
```json
[
  {
    "title": "{recipe title}",
    "ingredients": ["{ingredient}", "{ingredient}", ...],
    "directions": ["{direction}", "{direction}", ...]
  },
  ...
]
```

- **401** Unauthorized
```json
{
  "message": "Access Denied: Invalid Token"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```

---

## PUT

### Change User Token Count

**Endpoint**: `/v1/users?user={userId}`

**Content-Type**: `application/json`

**Body**: 
```json
{
  "newTokens" : "{new token amount}"
}
```

**Response**: `JSON`

- **200** Ok
```json
{
  "message": "Updated user tokens!"
}
```

- **401** Unauthorized
```json
{
  "message": "Access Denied: Invalid Token"
}
```

- **401** Unauthorized
```json
{
  "message": "This magic is not for you!"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```

---

## DELETE

### Delete User
**Endpoint**: `/v1/users?user={userId}`

**Content-Type**: `application/json`

**Body**: `None`

**Response**: `JSON`

- **200** Ok
```json
{
  "message": "User has been deleted!"
}
```

- **401** Unauthorized
```json
{
  "message": "Access Denied: Invalid Token"
}
```

- **401** Unauthorized
```json
{
  "message": "This magic is not for you!"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```

### Delete Favourite

**Endpoint**: `/v1/favourites?recipe={recipeId}`

**Content-Type**: `application/json`

**Body**: `None`

**Response**: `JSON`

- **200** Ok
```json
{
  "message": "Recipe forgotten"
}
```

- **401** Unauthorized
```json
{
  "message": "Access Denied: Invalid Token"
}
```

- **500** Server Error
```json
{
  "message": "Something went wrong!"
}
```