const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'html', 'home.html');
let html = fs.readFileSync(filePath, 'utf8');

const mainStart = html.indexOf('<main>');
const mainEnd = html.indexOf('</main>') + '</main>'.length;

const main = fs.readFileSync(path.join(__dirname, 'home-main-snippet.html'), 'utf8');

const footerStart = html.indexOf('<footer>');
const footerBlock = html.slice(footerStart, html.indexOf('<script'));

const scripts = `
  <script src="/js/home-experience.js"></script>
  <script src="/js/matrixrain.js"></script>
  <script src="/js/load-header.js"></script>
  <script src="/js/js.js"></script>
  <script src="/js/auth-manager.js"></script>
  <script src="/js/progress-manager.js"></script>
</body>
</html>
`;

const head = html.slice(0, mainStart);
const footer = footerBlock.replace(/<div class="footer-label">[^<]*2026<\/div>/, '<div class="footer-label">© 2026</div>');

html = head + main.trim() + '\n\n' + footer.trim() + '\n' + scripts;
fs.writeFileSync(filePath, html, 'utf8');
console.log('home.html patched');
