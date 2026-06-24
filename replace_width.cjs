const fs = require('fs');
const path = require('path');

const replacement = 'w-[794px] min-h-[1123px]';
const regex = /w-\[800px\]/g;

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (regex.test(content) && (fullPath.includes('DeviceEntry') || fullPath.includes('DeviceExit') || fullPath.includes('ApprovalAndParts') || fullPath.includes('Inspection') || fullPath.includes('Maintenance') || fullPath.includes('MaintenanceActionForm') || fullPath.includes('Vault'))) {
                console.log('Replacing in', fullPath);
                content = content.replace(regex, replacement);
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}

processDir(path.join(__dirname, 'src', 'components'));
