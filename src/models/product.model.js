import mongoose from "mongoose";
const productSchema = new mongoose.Schema({
    name : {type : String, required : true, trim : true},
    slug : {type : String, required : true, unique : true, lowercase : true},
    description : {type : String, trim : true},
    price : {type : Number, required : true, min : 0},
    categoryId  : {type : mongoose.Schema.Types.ObjectId, ref: "category", required : true},
    categoryPath : [mongoose.Schema.Types.ObjectId],
    images : [String],
    attributes: [{ key : {type : String ,required : true} , value : mongoose.Schema.Types.Mixed }],
    createdBy : {type :String, required : true},
    isActive : {type : Boolean, default : true},
},
 {timestamps : true}
);


productSchema.index({ price: 1 });
productSchema.index({ isActive: 1, categoryPath: 1, price: 1 });

const product = mongoose.model("product",productSchema);
export default product;
