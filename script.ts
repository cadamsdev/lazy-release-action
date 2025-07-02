
import { globSync } from 'tinyglobby';

(async () => {
  const packageFiles = globSync('**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  console.log(packageFiles);
})();
