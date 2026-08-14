import nodemailer from "nodemailer"
import AppError from "./AppError.js";

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendmail = async({to,subject,text}) =>{
  if(!to){
    throw new AppError("Receiver Mail is required",500)
  }
  if(!subject){
    throw new AppError("Subject is required", 500)
  }
  if(!text){
    throw new AppError("text is required", 500)
  }
 await transporter.sendMail({
    from : process.env.SMTP_FROM,
    to , subject, text
 })
}

