export function formatLinks(text: string, format: 'markdown' | 'html'): string {
    // For markdown, no transformation needed if links are already in [text](url) format
    if (format === 'markdown') {
        return text;
    }

    // For HTML, convert [text](url) to <a href="url">text</a>
    if (format === 'html') {
        return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    }

    return text;
}