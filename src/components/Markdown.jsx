import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// メモ用のMarkdownレンダラー（GFM: 表・チェックリスト・打ち消し線など対応）
export default function Markdown({ children, className = '' }) {
  if (!children) return null
  return (
    <div className={`md-body text-[13px] text-[#3C3C43] leading-relaxed break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[#007AFF] underline underline-offset-1 break-all"
            />
          ),
          h1: ({ node, ...props }) => <h1 {...props} className="text-[16px] font-bold text-[#1C1C1E] mt-2 mb-1 first:mt-0" />,
          h2: ({ node, ...props }) => <h2 {...props} className="text-[15px] font-bold text-[#1C1C1E] mt-2 mb-1 first:mt-0" />,
          h3: ({ node, ...props }) => <h3 {...props} className="text-[14px] font-semibold text-[#1C1C1E] mt-2 mb-0.5 first:mt-0" />,
          p: ({ node, ...props }) => <p {...props} className="my-1 first:mt-0 last:mb-0 whitespace-pre-wrap" />,
          ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-5 my-1 space-y-0.5" />,
          ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-5 my-1 space-y-0.5" />,
          li: ({ node, ...props }) => <li {...props} className="marker:text-[#AEAEB2]" />,
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-[3px] border-black/15 pl-3 my-1.5 text-[#8E8E93]" />
          ),
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code {...props} className="px-1 py-0.5 rounded bg-black/[0.06] text-[12px] font-mono text-[#1C1C1E]" />
            ) : (
              <code {...props} className="font-mono text-[12px]" />
            ),
          pre: ({ node, ...props }) => (
            <pre {...props} className="my-1.5 p-2.5 rounded-[8px] bg-black/[0.05] overflow-x-auto text-[12px]" />
          ),
          hr: ({ node, ...props }) => <hr {...props} className="my-2 border-black/10" />,
          table: ({ node, ...props }) => (
            <div className="my-1.5 overflow-x-auto">
              <table {...props} className="w-full text-[12px] border-collapse" />
            </div>
          ),
          thead: ({ node, ...props }) => <thead {...props} className="bg-black/[0.04]" />,
          th: ({ node, ...props }) => (
            <th {...props} className="border border-black/10 px-2 py-1 font-semibold text-left text-[#1C1C1E]" />
          ),
          td: ({ node, ...props }) => (
            <td {...props} className="border border-black/10 px-2 py-1 align-top" />
          ),
          input: ({ node, ...props }) => (
            <input {...props} disabled className="mr-1 align-middle accent-[#007AFF]" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
