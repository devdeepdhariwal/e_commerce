import mongoose from "mongoose";
const productSchema = new mongoose.Schema({
    name : {type : String, required : true, trim : true},
    slug : {type : String, required : true, unique : true, lowercase : true},
    description : {type : String, trim : true},
    price : {type : Number, required : true, min : 0},
    category : {type : String, required : true},
    images : [String],
    variants : [{size : String, color : String, stock : {type : Number, min : 0}}],
    createdBy : {type :String, required : true},
    isActive : {type : Boolean, default : true},
},
 {timestamps : true}
);

const product = mongoose.model("product",productSchema);
export default product;
