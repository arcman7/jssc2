module.exports = {
    "extends": [
        "airbnb-base",
    ],
    "plugins": [
        "import"
    ],
    "rules": {
        "yoda": 0,
        "import/no-dynamic-require": 0,
        "no-prototype-builtins": 0,
        'object-curly-newline': 0,
        'prefer-template': 0,
        "no-param-reassign": 0,
        "prefer-destructuring": 0,
        "max-classes-per-file": 0,
        "no-param-reassign": 0,
        "no-underscore-dangle": 0,
        "quotes": 0,
        "semi": 0,
        "comma-dangle": 0,
        "valid-jsdoc": 0,
        "eqeqeq": 0,
        "dot-notation": 0,
        "spaced-comment": 0,
        "no-var": 0,
        "import/no-mutable-exports": 0,
        "indent": ["error", 2],
        "space-before-function-paren": 0,
        "import/no-named-as-default": 0,
        "import/no-named-as-default-member": 0,
        "no-bitwise": 0,
        "object-shorthand": 0,
        "no-console": 0,
        "quote-props": 0,
        "consistent-return": 0,
        "guard-for-in": 0,
        "no-plusplus": 0,
        "prefer-arrow-callback": 0,
        "import/extensions": ["error", "never", { "packages": "always" }],
        "import/no-extraneous-dependencies": ["error", { "devDependencies": true }],
        "linebreak-style": 0,
        "max-len": "off",
        "camelcase": 0,
        "no-await-in-loop": 0
    },
    "env": {
        "browser": true,
        "jquery": true,
        "jest": true
    },
    "globals": {
    },
    "settings": {
        "import/resolver": {
            "webpack": {
                "config": "build/webpack.dev.config.js"
            }
        }
    }
};
