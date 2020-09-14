const { spawn } = require('child_process')

const child = spawn('find . -type f | wc -l', {
  shell: true,
  cwd: '/Users/samer/Downloads'
})
