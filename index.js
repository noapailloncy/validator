'use strict';

const chalk = require('chalk');
const isEmail = require('validator/lib/isEmail');
const isURL = require('validator/lib/isURL');

class Validator {
  constructor(data, model) {
    this.data = data;
    this.model = model;
    this.errors = {};
    this.rules = [
      {
        name: 'array',
        callback: (data) => {
          return (Array.isArray(data)) ? true : false;
        },
        errorMessage: () => {
          return 'must be an array';
        }
      },
      {
        name: 'boolean',
        callback: (data) => {
          return (typeof data === 'boolean') ? true : false;
        },
        errorMessage: () => {
          return 'must be a boolean';
        }
      },
      {
        name: 'date',
        callback: (data) => {
          if (/^([0-9]{2})\/(0[1-9]|1[0-2])\/([0-9]{4})$/.test(data)) {
            const day = Number(data.slice(0, 2));
            const month = Number(data.slice(3, 5));
            const year = Number(data.slice(6, 10));

            let maxDays;

            if (month === 2) {
              if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
                maxDays = 29;
              } else {
                maxDays = 28;
              }
            } else if (month % 2 === 0) {
              maxDays = 30;
            } else {
              maxDays = 31;
            }

            if (day >= 1 && day <= maxDays) {
              return true;
            }
          }
        },
        errorMessage: () => {
          return 'date is invalid';
        }
      },
      {
        name: 'email',
        callback: (data, model) => {
          const params = model.params || {};
          return (isEmail(String(data), params)) ? true : false;
        },
        errorMessage: () => {
          return 'email is invalid';
        }
      },
      {
        name: 'number',
        callback: (data) => {
          return (typeof data === 'number') ? true : false;
        },
        errorMessage: () => {
          return 'must be a number';
        }
      },
      {
        name: 'string',
        callback: (data, model) => {
          if (typeof data === 'string') {
            const params = model.params || {};
            const min = params.min || 1;
            const max = params.max || null;

            if (typeof min !== 'number' || max && typeof max !== 'number') {
              console.log(new Error(chalk.red(`params 'min' and 'max' must be numbers or nulls.`)));
              process.exit(1);
            } else {
              if (min < max || !max) {
                return (data.length >= min && (data.length <= max || !max)) ? true : false;
              } else {
                console.log(new Error(chalk.red(`param 'min' must be less than 'max'.`)));
                process.exit(1);
              }
            }
          }
        },
        errorMessage: (data) => {
          if (typeof data === 'string') {
            const params = model.params || {};
            const min = params.min || 1;
            const max = params.max || null;

            if (data.length < min) {
              return `must be min=${min} characters.`;
            } else if (data.length > max) {
              return `must be max=${max} characters.`;
            }
          } else {
            return 'must be a string';
          }
        }
      },
      {
        name: 'url',
        callback: (data, model) => {
          const params = model.params || {};
          return (isURL(String(data), params)) ? true : false;
        },
        errorMessage: () => {
          return 'url is invalid';
        }
      }
    ];
  }

  extend(name, callback, errorMessage = null) {
    if (name && callback) {
      if (typeof name === 'string') {
        const rule = this.rules.find(rule => rule.name === name);

        if (rule === undefined) {
          if (typeof callback === 'function') {
            if (typeof errorMessage === 'string' || errorMessage === null) {
              const rule = {
                name: name,
                callback: callback,
                errorMessage: errorMessage || 'is invalid'
              };

              this.rules.push(rule);
            } else {
              console.log(new Error(chalk.red(`param 'errorMessage' must be a string.`)));
              process.exit(1);
            }
          } else {
            console.log(new Error(chalk.red(`param 'callback' must be a function.`)));
            process.exit(1);
          }
        } else {
          console.log(new Error(chalk.red(`rule '${name}' already exists.`)));
          process.exit(1);
        }
      } else {
        console.log(new Error(chalk.red(`param 'name' must be a string.`)));
        process.exit(1);
      }
    } else {
      console.log(new Error(chalk.red(`params 'name' and 'callback' are required.`)));
      process.exit(1);
    }
  }

  validate() {
    this.errors = this.data;

    const recursion = (input, schema, errors) => {
      if (input && schema) {
        if (typeof (input) === 'object' && typeof (schema) === 'object') {
          let success = true;

          for (const key in schema) {
            if (input.hasOwnProperty(key)) {
              let data = input[key];
              let model = schema[key];

              if (typeof model === 'string') {
                let rule;

                if (model.includes(':')) {
                  rule = this.rules.find(rule => rule.name === model.slice(0, model.indexOf(':')));
                } else {
                  rule = this.rules.find(rule => rule.name === model);
                }

                if (rule !== undefined) {
                  if (data === null || data === undefined) {
                    errors[key] = 'is required';
                    success = false;
                  } else if (rule.callback(data, { type: model })) {
                    errors[key] = 'success';
                  } else {
                    errors[key] = rule.errorMessage(data);
                    success = false;
                  }
                } else {
                  console.log(new Error(chalk.red(`${key}: type is invalid.`)));
                  process.exit(1);
                }
              } else if (model !== (null || undefined) && typeof model === 'object') {
                model[0].required = model[0].required || true;

                if (Array.isArray(model)) {
                  if (model.length === 1) {
                    if (Array.isArray(data)) {
                      data.forEach((element, index) => {
                        if (typeof element === 'object') {
                          if (!recursion(element, model[0], errors[key][index])) {
                            success = false;
                          }
                        } else {
                          errors[key] = 'success';
                        }
                      });
                    } else {
                      if (typeof model[0].type === 'string') {
                        if (typeof model[0].required === 'boolean') {
                          if (model[0].params && typeof model[0].params !== 'object' && Array.isArray(model[0].params)) {
                            console.log(new Error(chalk.red(`${key}: param 'params' must be a object.`)));
                            process.exit(1);
                          } else {
                            let rule;

                            if (model[0].type.includes(':')) {
                              rule = this.rules.find(rule => rule.name === model[0].type.slice(0, model[0].type.indexOf(':')));
                            } else {
                              rule = this.rules.find(rule => rule.name === model[0].type);
                            }

                            if (rule !== undefined) {
                              if (model[0].required && data == (null || undefined)) {
                                errors[key] = 'is required';
                                success = false;
                              } else if (rule.callback(data, model[0]) || data == (null || undefined)) {
                                errors[key] = 'success';
                              } else {
                                if (model[0].errorMessage) {
                                  if (typeof model[0].errorMessage === 'string') {
                                    errors[key] = model[0].errorMessage;
                                    success = false;
                                  } else {
                                    console.log(new Error(chalk.red(`${key}: param 'errorMessage' must be a string.`)));
                                    process.exit(1);
                                  }
                                } else {
                                  errors[key] = rule.errorMessage(data, model[0]);
                                  success = false;
                                }
                              }
                            } else {
                              console.log(new Error(chalk.red(`${key}: type is invalid.`)));
                              process.exit(1);
                            }
                          }
                        } else {
                          console.log(new Error(chalk.red(`${key}: param 'required' must be a boolean.`)));
                          process.exit(1);
                        }
                      } else {
                        console.log(new Error(chalk.red(`${key}: param 'type' must be a string.`)));
                        process.exit(1);
                      }
                    }
                  } else {
                    console.log(new Error(chalk.red(`${key}: model is invalid.`)));
                    process.exit(1);
                  }
                } else {
                  if (!recursion(data, model, errors[key])) {
                    success = false;
                  }
                }
              } else {
                console.log(new Error(chalk.red(`${key}: model is invalid.`)));
                process.exit(1);
              }
            } else {
              console.log(new Error(chalk.red(`${key}: key no exist.`)));
              process.exit(1);
            }
          }

          return success;
        } else {
          console.log(new Error(chalk.red(`params 'input' or 'schema' is invalid.`)));
          process.exit(1);
        }
      } else {
        console.log(new Error(chalk.red(`params 'input' and 'schema' are required.`)));
        process.exit(1);
      }
    }

    return recursion(this.data, this.model, this.errors);
  }
}

module.exports = {
  Validator: Validator
}
