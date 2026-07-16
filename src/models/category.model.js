import mongoose from "mongoose";
const categorySchema = new mongoose.Schema({
    name : {type : String, required : true, trim : true},
    slug : {type : String, required : true, unique : true, lowercase : true},
    parentId : {type : mongoose.Schema.Types.ObjectId, ref : "category", default : null},
    path :[mongoose.Schema.Types.ObjectId],
    isActive : {type : Boolean, default : true},
},
{timestamps : true}
)

categorySchema.index({isActive : 1, parentId : 1})
const category = mongoose.model("category",categorySchema)
export default category;