import bcrypt from "bcrypt";

export const hashPassword = async(password) => {
    const hashedPassword = await bcrypt.hash(password,10);
    return hashedPassword;
};

export const compareHash = async(password, hash) =>{
  return await bcrypt.compare(password,hash);
}