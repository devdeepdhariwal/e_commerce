import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
    attributes: { type: Map, of: String, required: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    sku: { type: String, required: true },
});

const productSchema = new mongoose.Schema({
    name : {type : String, required : true, trim : true},
    slug : {type : String, required : true, unique : true, lowercase : true},
    description : {type : String, trim : true},
    categoryId  : {type : mongoose.Schema.Types.ObjectId, ref: "category", required : true},
    categoryPath : [mongoose.Schema.Types.ObjectId],
    images : [String],
    variants : { type: [variantSchema], required: true, validate: v => v.length > 0 },
    createdBy : {type :String, required : true},
    isActive : {type : Boolean, default : true},
},
 {timestamps : true}
);


productSchema.index({ "variants.price": 1 });
productSchema.index({ isActive: 1, categoryPath: 1 });

const product = mongoose.model("product",productSchema);
export default product;
