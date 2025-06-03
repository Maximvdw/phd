import Client from 'ssh2-sftp-client';
import path from 'path';
import dotenv from 'dotenv';
import ora from 'ora';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deploy() {
    if (process.env.SFTP_HOST === undefined || String(process.env.SFTP_HOST).length === 0) {
        throw new Error('SFTP_HOST is not defined in the .env file. Please define it and try again.');
    }
    if (process.env.SFTP_USER === undefined || String(process.env.SFTP_USER).length === 0) {
        throw new Error('SFTP_USER is not defined in the .env file. Please define it and try again.');
    }
    if (process.env.SFTP_SSH_KEY === undefined || String(process.env.SFTP_SSH_KEY).length === 0) {
        throw new Error('SFTP_SSH_KEY is not defined in the .env file. Please define it and try again.');
    }
    if (process.env.SFTP_REMOTE_DIR === undefined || String(process.env.SFTP_REMOTE_DIR).length === 0) {
        throw new Error('SFTP_REMOTE_DIR is not defined in the .env file. Please define it and try again.');
    }

    const localDir = path.join(__dirname, "..", "_site") + path.sep;
    const sftp = new Client();

    const config = {
        host: process.env.SFTP_HOST,
        port: process.env.SFTP_PORT || 22,
        username: process.env.SFTP_USER,
        privateKey: fs.existsSync(process.env.SFTP_SSH_KEY) 
            ? fs.readFileSync(process.env.SFTP_SSH_KEY) 
            : (() => { throw new Error(`SSH key file not found at ${process.env.SFTP_SSH_KEY}`); })(),
        passphrase: process.env.SFTP_SSH_PASSWORD
    };

    const spinner = ora('Deploying files...').start();

    try {
        await sftp.connect(config);
        console.log(`🚚 Deploy started of ${localDir}`);

        async function deleteRemoteDirectory(remoteDir) {
            try {
                const files = await sftp.list(remoteDir);

                for (const file of files) {
                    const remoteFilePath = path.join(remoteDir, file.name);

                    if (file.type === 'd') {
                        await deleteRemoteDirectory(remoteFilePath);
                        await sftp.rmdir(remoteFilePath);
                        console.log(`🗑️ Deleted remote directory ${remoteFilePath}`);
                    } else {
                        await sftp.delete(remoteFilePath);
                        console.log(`🗑️ Deleted remote file ${remoteFilePath}`);
                    }
                }
            } catch (err) {
                console.log(`Failed to delete remote directory ${remoteDir}:`, err);
            }
        }

        await deleteRemoteDirectory(process.env.SFTP_REMOTE_DIR);
        async function uploadDirectory(localDir, remoteDir) {
            const files = fs.readdirSync(localDir);

            for (const file of files) {
                const localFilePath = path.join(localDir, file);
                const remoteFilePath = path.join(remoteDir, file);

                if (fs.lstatSync(localFilePath).isDirectory()) {
                    console.log(`📁 Creating remote directory ${remoteFilePath}`);
                    await sftp.mkdir(remoteFilePath, true);
                    await uploadDirectory(localFilePath, remoteFilePath);
                } else {
                    console.log(`\t📦 Deploying ${file}`);
                    await sftp.fastPut(localFilePath, remoteFilePath);
                }
            }
        }

        await uploadDirectory(localDir, process.env.SFTP_REMOTE_DIR);

        spinner.succeed('🚀 Deploy done!');
    } catch (err) {
        spinner.fail('Deploy failed');
        console.log(err);
    } finally {
        sftp.end();
    }
}

deploy();
