'use client'

import {
    HiOutlineDocumentText,
    HiOutlinePencil,
    HiOutlineEye
} from 'react-icons/hi'

export function formatTime(ms: number): string {
    const seconds = ms / 1000
    return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

export function getFileName(path: string): string {
    return path.split('/').pop() || path
}

export function getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || ''
    const langMap: Record<string, string> = {
        'py': 'python', 'js': 'javascript', 'jsx': 'jsx', 'ts': 'typescript', 'tsx': 'tsx',
        'json': 'json', 'md': 'markdown', 'yaml': 'yaml', 'yml': 'yaml', 'sh': 'bash',
        'bash': 'bash', 'css': 'css', 'html': 'markup', 'xml': 'markup', 'sql': 'sql',
        'go': 'go', 'rs': 'rust', 'rb': 'ruby', 'java': 'java', 'c': 'c', 'cpp': 'cpp'
    }
    return langMap[ext] || 'text'
}

export function getFileIcon(toolName: string) {
    const name = toolName.toLowerCase()
    if (name === 'write') return HiOutlineDocumentText
    if (name === 'edit') return HiOutlinePencil
    return HiOutlineEye
}

export const monokaiTheme = {
    plain: {
        color: '#F8F8F2',
        backgroundColor: '#1e1e1e',
    },
    styles: [
        { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#75715E' } },
        { types: ['punctuation'], style: { color: '#F8F8F2' } },
        { types: ['property', 'tag', 'constant', 'symbol', 'deleted'], style: { color: '#F92672' } },
        { types: ['boolean', 'number'], style: { color: '#AE81FF' } },
        { types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'], style: { color: '#E6DB74' } },
        { types: ['operator', 'entity', 'url', 'variable'], style: { color: '#F8F8F2' } },
        { types: ['atrule', 'attr-value', 'function', 'class-name'], style: { color: '#A6E22E' } },
        { types: ['keyword'], style: { color: '#F92672' } },
        { types: ['regex', 'important'], style: { color: '#FD971F' } },
    ],
}
