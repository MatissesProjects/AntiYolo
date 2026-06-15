const parse = require('bash-parser');
console.log(JSON.stringify(parse('sudo rm -rf /'), null, 2));
console.log(JSON.stringify(parse('echo $(rm -rf /)'), null, 2));
