import bcrypt from "bcrypt";

export const hashpassword = async(password) => {
    const hashedpassword = await bcrypt.hash(password,10);
    return hashedpassword;
};

export const comparehash = async(password, hash) =>{
  return await bcrypt.compare(password,hash);
}