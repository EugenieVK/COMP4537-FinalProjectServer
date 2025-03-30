# Meal Mancer Backend

## SQL API Documentation

**Base URL**: `https://meal-mancer-api-q3zh9.ondigitalocean.app`

## POST

### Login 

**Endpoint**: `/login`

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

---

### Signup

**Endpoint**: `/signup`

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

---

### Logout

**Endpoint**: `/logout`

**Content-Type**: `None`

**Body**: `None`

**Response**: `JSON`

- **200** Ok
```json
{
  "message": "Successful Logout!"
}
```

---

## GET

### Generate Recipe 

**Endpoint**: `/generate/?ingredients={ingredients}`

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
    "password": "{password}",
    "tokens": "{number of tokens left}",
    "httpRequests": "{number of requests made}"
  },
  ...
]
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
    "id": "{id}",
    "method": "{GET | POST | DELETE | ...}",
    "endpoint": "{API endpoint}",
    "requests": "{number of requests made}"
  },
  ...
]
```
