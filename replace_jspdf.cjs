const fs = require('fs');
const path = require('path');

const replacement = `              const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
              });

              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
              let heightLeft = pdfHeight;
              let position = 0;

              pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
              heightLeft -= pdf.internal.pageSize.getHeight();

              while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
                heightLeft -= pdf.internal.pageSize.getHeight();
              }
`;

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            // Regex to find:
            // const pdf = new jsPDF({ ... format: [mmWidth, mmHeight] ... });
            // pdf.addImage(imgData, ... );
            
            const regex = /const\s+pdf\s*=\s*new\s+jsPDF\s*\(\s*{\s*orientation:\s*'portrait',\s*unit:\s*'mm',\s*format:\s*\[mmWidth,\s*mmHeight\],\s*compress:\s*true\s*}\s*\);\s*pdf\.addImage\(imgData,\s*'JPEG',\s*0,\s*0,\s*mmWidth,\s*\(canvas\.height\s*\*\s*mmWidth\)\s*\/\s*canvas\.width,\s*undefined,\s*'FAST'\);/gs;
            const matches = content.match(regex);
            
            if (matches) {
                console.log('Replacing in', fullPath);
                content = content.replace(regex, replacement.trim());
                fs.writeFileSync(fullPath, content, 'utf8');
            }

            // Let's also check for PrintPreviewOverlay which uses a4 but didn't have compress: true maybe?
            // Actually PrintPreviewOverlay already has format: 'a4'.
        }
    }
}

processDir(path.join(__dirname, 'src', 'components'));
