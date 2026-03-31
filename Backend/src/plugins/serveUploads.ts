import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify"
import fp from 'fastify-plugin'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

async function serveUploads(fastify: FastifyInstance, opts: FastifyPluginOptions) {
    const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
    
    fastify.route(
    {
        method: "GET",
        url: '/api/uploads/:filename',
       handler:async (request: FastifyRequest<{Params:{filename: string}}>, reply: FastifyReply) => {
        const { filename } = request.params;
        try {
            if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid filename'
                });
            }
            
            const filePath = path.join(UPLOAD_DIR, filename);
            
            if (!existsSync(filePath)) {
                fastify.log.warn('File not found:' + filePath);
                return reply.code(404).send({
                    success: false,
                    message: 'File not found',
                    path: filePath
                });
            }
            const fileBuffer = await readFile(filePath);
            
            const ext = path.extname(filename).toLowerCase();
            
            const contentTypes: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            };
            
            const contentType = contentTypes[ext] || 'application/octet-stream';
            
            return reply
                .header('Content-Type', contentType)
                .header('Content-Length', fileBuffer.length)
                .header('Cache-Control', 'public, max-age=31536000')
                .send(fileBuffer);
                
        } catch (error) {
            fastify.log.error('Error serving file:' + error);
            return reply.code(404).send({
                success: false,
                message: 'Error serving file',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }});
}

export default fp(serveUploads, {
    name: 'serve-uploads'
})