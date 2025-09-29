const fs=require('fs');const text=fs.readFileSync('components/list-header.tsx','utf8');console.log(text.includes('{ }'));
