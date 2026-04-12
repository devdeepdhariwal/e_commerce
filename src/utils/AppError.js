class AppError extends Error {
    constructor(message,statusCode){
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.name = "AppError";
        Error.captureStackTrace(this,this.constructor);

    }
}

export default AppError;
