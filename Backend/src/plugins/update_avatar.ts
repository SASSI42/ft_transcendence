import { FastifyInstance, FastifyPluginOptions } from "fastify"
import fp from 'fastify-plugin'
import multipart from "@fastify/multipart"
import path from "node:path"
import {pipeline} from 'node:stream/promises'
import { createWriteStream, unlink, access, constants} from "node:fs"


interface body_type{
    password:{value: string},
    filename: string
    file:{
        filename: string
    }
}

interface userType{
    Avatar: string;
    id:string | number
}

async function update_avatar(fastify:FastifyInstance, opts:FastifyPluginOptions)
{
    const UPLOAD_DIR = path.join(process.cwd(), '/uploads')
    fastify.register(multipart, {
        limits: {
            fileSize: 5 * 1024 * 1024,
            files: 1
        }
    });
    fastify.route<{Body:body_type}>({
        method: "POST",
        url: '/api/user/update_avatar',
        schema: {
            response:{
                200: {
                    type:"object",
                    properties:{
                        success: {type:'boolean'},
                        message: {type: 'string'}
                    }
                },
                '4xx':{
                    type:"object",
                    properties:{
                        success: {type: 'boolean'},
                        message: {type: 'string'}
                    }
                }
            }
        },
        handler: async function update_profile(request, reply){
            const Token = request.cookies.access_token;
            if (!Token){
                return reply.code(401).send({
                    success:false,
                    message: 'Unauthorized: Access token missing.'
                })
            }
            try{
                let decoded = null
                try{
                    decoded = await fastify.jwt.verify(Token) as any;
                }catch(error)
                {
                    request.log.error(error);
                    return reply.code(400).send({
                        success: false,
                        message: "The token is expired"
                    })
                }
                const get_user = fastify.db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.sub) as userType | undefined;
                if (!get_user)
                {
                    return reply.code(400).send({
                        success: false,
                        message: "User account not found."
                    })
                }
                let fileData: any = null;
                fileData = await request.file() || {};
                if (!fileData)
                {
                    return reply.code(400).send({
                        success: false,
                        message: "Bad Request: No file uploaded"
                    })
                }
                const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (!allowedMimeTypes.includes(fileData.mimetype))
                {
                    return reply.code(400).send({
                        success: false,
                        message: "Bad Request : Only image files are allowed (JPEG, PNG, GIF, WebP)"
                    })
                }

                const fileExtension = path.extname(fileData.filename) || '.jpg';
                const newFilename = `${get_user.id}_avatar_${Date.now()}${fileExtension}`;
				const avatarPathInDB = `/api/uploads/${newFilename}`;
                const filePath = path.join(UPLOAD_DIR, newFilename);

                if (get_user.Avatar && get_user.Avatar[0] === '/' && get_user.Avatar !== '/api/uploads/default_avatar.png') {
                    const oldFileName = path.basename(get_user.Avatar);
                    const oldFilePath = path.join(UPLOAD_DIR, oldFileName);
                    access(oldFilePath, constants.F_OK, (err) => {
                        if (!err) {
                            unlink(oldFilePath, (unlinkErr) => {
                                if (unlinkErr) request.log.error("Could not remove old file: " + unlinkErr);
                                else request.log.info("Successfully removed old file from folder");
                            });
                        }
                    });
                }

                fastify.db.prepare("UPDATE users SET Avatar = ? WHERE id = ?").run(avatarPathInDB, get_user.id);
                await pipeline(fileData.file, createWriteStream(filePath));
                return reply.code(200).send({
                success: true,
                message: "Avatar updated successfully",
                });
        }catch(error)
        {
            return reply.code(404).send({
                success: false,
                message: "Internel server error"
            })
        }
        }
    })
}

export default fp(update_avatar, {
    name:'update_avatar'
})