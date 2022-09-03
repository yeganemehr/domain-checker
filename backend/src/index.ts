#!/usr/bin/env node --experimental-specifier-resolution=node

import 'reflect-metadata';
import program from './Commands/index';

program.parse();
