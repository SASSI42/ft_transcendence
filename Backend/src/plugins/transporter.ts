import { FastifyInstance, FastifyPluginOptions } from "fastify";
import fp from 'fastify-plugin'
import nodemailer from "nodemailer";

async function nodemailerTransporter(fastify:FastifyInstance, opts:FastifyPluginOptions){
    const google_EMAIL_USER = process.env.google_EMAIL_USER;
    const google_EMAIL_PASS = process.env.google_EMAIL_PASS;
    if (!google_EMAIL_PASS || !google_EMAIL_USER)
        throw new Error("Missing cridenntials");

    let transporter;
    try{
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth:{
                user: String(google_EMAIL_USER),
                pass: String(google_EMAIL_PASS)
            }
        });
        await transporter.verify();
        fastify.decorate('mailer', transporter);
        fastify.log.info('Nodemailer transporter successfully connected and verified.');
    }catch(error){
    fastify.decorate('mailer', {
        sendMail: ()=>{
            throw new Error("Mailer not initialized. Cannot send email.");
            }
        }
        )
    }
}

export default fp(nodemailerTransporter,{
    name: "mailer"}
)