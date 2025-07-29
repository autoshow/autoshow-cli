// src/utils/node-utils.ts

import { promisify } from 'node:util'
import { argv, env, exit } from 'node:process'
import { fileURLToPath } from 'node:url'
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { exec, execFile, spawn, spawnSync, execSync } from 'node:child_process'
import { readFile, readdir, writeFile, access, unlink, rename, copyFile } from 'node:fs/promises'
import { basename, extname, join, dirname, isAbsolute, resolve, relative } from 'node:path'
import fs from 'node:fs/promises'
import path from 'node:path'

import { XMLParser } from 'fast-xml-parser'

export const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
})

export const execPromise = promisify(exec)
export const execFilePromise = promisify(execFile)

export const ensureDir = async (dir: string): Promise<void> => {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (error) {
    if ((error as { code?: string }).code !== 'EEXIST') throw error
  }
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export {
  argv,
  env,
  exit,
  fileURLToPath,
  readFile,
  readdir,
  access,
  writeFile,
  copyFile,
  basename,
  extname,
  join,
  dirname,
  isAbsolute,
  resolve,
  relative,
  unlink,
  rename,
  existsSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  exec,
  execFile,
  spawn,
  spawnSync,
  execSync,
  fs,
  path
}