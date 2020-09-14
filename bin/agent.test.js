const { spawn } = require('child_process')
//python -m pysc2.bin.agent --map Simple64
const child = spawn('npm run jssc2_agent --map Simple64', {
  shell: true,
})
