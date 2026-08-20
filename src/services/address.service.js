import prisma from "../config/db.js";



export const createAddress = async(userId,data) =>{
const { fullName, phone, line1, line2, city, state, postalCode, country } = data;
const address = await prisma.address.create({
    data: {
        userId,
        fullName,
        phone,
        line1,
        line2,
        city,
        state,
        postalCode,
        country
    }
});
return address;   
}

export const getMyAddresses= async(userId) => {
    return prisma.address.findMany({
        where : {userId},
        orderBy : {createdAt : "desc"}
    })
}
