import Script from 'next/script'

/**
 * Bare layout for the embeddable chat widget frame.
 * Intentionally contains no nav, header, footer, or marketing chrome —
 * this page is always displayed inside a sandboxed <iframe>.
 */
export default function ChatWidgetFrameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline blocking polyfill for crypto.randomUUID - runs before any other scripts */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){try{var g=typeof globalThis!=='undefined'?globalThis:typeof window!=='undefined'?window:this;if(!g.crypto){try{g.crypto={};}catch(e){}}if(g.crypto&&typeof g.crypto.randomUUID!=='function'){var p=function(){try{var b=new Uint8Array(16);if(g.crypto&&g.crypto.getRandomValues){g.crypto.getRandomValues(b);}else{for(var i=0;i<16;i++)b[i]=(Math.random()*256)|0;}b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;var h=[];for(var i=0;i<16;i++){var x=b[i];h.push((x<16?"0":"")+x.toString(16));}return h.slice(0,4).join("")+"-"+h.slice(4,6).join("")+"-"+h.slice(6,8).join("")+"-"+h.slice(8,10).join("")+"-"+h.slice(10,16).join("");}catch(e){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=(Math.random()*16)|0;var v=c==='x'?r:(r&0x3)|0x8;return v.toString(16);});}};try{g.crypto.randomUUID=p;}catch(e){try{Object.defineProperty(g.crypto,'randomUUID',{value:p,configurable:true,writable:true});}catch(e2){}}}}catch(err){}})();
        `}} />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
