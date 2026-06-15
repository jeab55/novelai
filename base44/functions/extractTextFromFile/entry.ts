import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import mammoth from 'npm:mammoth@1.8.0';
import pdfParse from 'npm:pdf-parse@1.1.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file');
        
        if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
        }

        const fileName = file.name.toLowerCase();
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let text = '';
        let fileType = 'unknown';

        // Handle different file types
        if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
            fileType = 'text';
            text = new TextDecoder().decode(uint8Array);
        } else if (fileName.endsWith('.docx')) {
            fileType = 'docx';
            const result = await mammoth.extractRawText({ arrayBuffer: uint8Array });
            text = result.value;
        } else if (fileName.endsWith('.pdf')) {
            fileType = 'pdf';
            const pdfData = await pdfParse(uint8Array);
            text = pdfData.text;
        } else {
            return Response.json({ 
                error: 'Unsupported file format. Supported: TXT, MD, DOCX, PDF' 
            }, { status: 400 });
        }

        return Response.json({ 
            text,
            file_type: fileType,
            file_name: file.name,
            character_count: text.length
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});