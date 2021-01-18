// @ts-ignore
const get = () => import(/* webpackChunkName: "eth-lattice-keyring" */ 'eth-lattice-keyring');
import LockConnector from '../src/connector';
import { getInjected } from '../src/utils';

export default class Connector extends LockConnector {
  async connect() {
    let provider;
    if (window['ethereum']) {
      provider = window['ethereum'];
      try {
        await window['ethereum'].enable();
      } catch (e) {
        console.error(e);
        if (e.code === 4001) return;
      }
    } else if (window['web3']) {
      provider = window['web3'].currentProvider;
    }
    // Initialize the Lattice keyring, unlock, and load the first account
    const network = this.options.network || 'mainnet';
    const LatticeKeyring = (await get()).default;
    const lattice = new LatticeKeyring({ name: 'Snapshot', network });
    try {
      await lattice.unlock()
      await lattice.addAccounts()
    } catch (err) {
      throw new Error(err);
      return
    }
    // Overload web3 provider functions with our Lattice keyring instance
    const getNetwork = () => { return network }
    const listAccounts = async () => {
      await lattice.unlock()
      const accounts = await lattice.getAccounts()
      return accounts
    }
    // Send methods
    const _signPersonal = (address, msg) => {
      return new Promise((resolve, reject) => {
        // Sanity check on msg. We want to display ASCII if possible
        let cleanedMsg = msg.slice(0, 2) === '0x' ? msg.slice(2) : msg
        cleanedMsg = Buffer.from(cleanedMsg, 'hex').toString();
        const isAscii = /^[\x00-\x7F]*$/.test(cleanedMsg);
        if (false === isAscii)
          cleanedMsg = msg;

        lattice.unlock()
        .then(() => {
          return lattice.signPersonalMessage(address, cleanedMsg)
        })
        .then((result) => {
          return resolve(result)
        })
        .catch((err) => {
          return reject(err);
        })
      })
    }

    const sendResolver = (sendFunc) => {
      function overLoadedSend(method, params) {
        switch (method) {
          case 'personal_sign':
            return _signPersonal(params[1], params[0]);
          default:
            return sendFunc(params);
        }
      }
      return overLoadedSend;
    }
    // Set the web3 functionality as a provider attribute
    provider.web3 = { sendResolver, getNetwork, listAccounts }
    return provider;
  }
}
