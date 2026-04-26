Register — validation, password hashing, duplicate check

Login — credential verification, JWT access token + refresh token

Refresh Token — rotate on use, hashed storage, expiry check

Logout — token invalidation from DB

getMe — protected route with JWT middleware

Security — httpOnly cookies, SHA-256 token hashing, AppError handling

