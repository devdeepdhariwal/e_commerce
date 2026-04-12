function errorHandler(err,req,res,next){

   const statusCode = err.statusCode || 500;
   const message = err.message || "something went wrong";
    
    if(err.isOperational){
       return res.status(statusCode).json({success : false, message : message});
    }

    if(!err.isOperational){
        if(process.env.NODE_ENV === "development"){
         return res.status(statusCode).json({
            success : false,
            message : message,
            error : err,
            stack : err.stack,
         });
        }
        else
       { return res.status(500).json({success : false , message : "Internal server error"});}
    }
}

export default errorHandler;