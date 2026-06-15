import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { file_name, file_type, file_data } = body;
        
        if (!file_data) {
            return Response.json({ error: 'No file data provided' }, { status: 400 });
        }

        // แปลง base64 เป็น Uint8Array
        const base64Data = file_data.split(',')[1] || file_data;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const fileName = file_name.toLowerCase();
        let text = '';
        let fileType = 'unknown';

        // Handle different file types
        if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
            fileType = 'text';
            text = new TextDecoder().decode(bytes);
        } else if (fileName.endsWith('.docx')) {
            fileType = 'docx';
            const mammoth = await import('npm:mammoth@1.8.0');
            const result = await mammoth.default.extractRawText({ arrayBuffer: bytes.buffer });
            text = result.value;
        } else if (fileName.endsWith('.pdf')) {
            fileType = 'pdf';
            const pdfParse = await import('npm:pdf-parse@1.1.1');
            const pdfData = await pdfParse.default(bytes);
            text = pdfData.text;
        } else {
            return Response.json({ 
                error: 'Unsupported file format. Supported: TXT, MD, DOCX, PDF' 
            }, { status: 400 });
        }

        return Response.json({ 
            text,
            file_type: fileType,
            file_name: file_name,
            character_count: text.length
        });
    } catch (error) {
        console.error('Error extracting text:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});