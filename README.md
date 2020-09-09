# jssc2

StarCraft II Learning Environment

This package is a JavaScript port of the deepmind/pysc2 Starcraft II environment and library for training agents. 

- All core functionality will be kept the same, including the user command line api, however memory usage and performance may very to some degree for certain modules. Please run the tests in the `tests` directory for more information.

### Browser rendering

![RGB Rendering 256x256 resolution](https://cdn.discordapp.com/attachments/665065185190608898/749400452067491890/unknown.png)

![Manual feature-layer rendering](https://cdn.discordapp.com/attachments/665065185190608898/749397175724802220/unknown.png)

Progress tracked [here](https://docs.google.com/spreadsheets/d/1V8KMPZJJE0mjzI4Z8px06jS8sZL3zfR5a_fcmFsiUpU/edit?ts=5e8904ba#gid=0)

### Untested code paths
- lib/video_writer.js [see these docs for more info](https://www.npmjs.com/package/fluent-ffmpeg)

### Rendering Tests
- Using a mocked up draw_base_map function call to test rendering computation time
    [Tensorflow vs Vanilla JS](https://docs.google.com/spreadsheets/d/1yGwn0pfzlgjQ76WZ7ItQjCOhIF7B2BMgumE0DzyM9-Q/edit?usp=sharing)
