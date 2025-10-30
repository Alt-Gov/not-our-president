import fs from "fs";
import path from "path";
import Twig from "twig";

const pages = [
  { src: "src/pages/index.twig", dest: "dist/index.html" },
  { src: "src/pages/home.twig", dest: "dist/home.html" }
];

for (const { src, dest } of pages) {
  Twig.renderFile(src, {}, (err, html) => {
    if (err) throw err;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, html);
    console.log(`✅ Rendered ${dest}`);
  });
}
