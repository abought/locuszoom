/**
 * @module
 * @private
 */
import {ClassRegistry} from './base';
import * as layers from '../components/data_layer';

const registry = new ClassRegistry();
for (let [name, type] of Object.entries(layers)) {
    registry.add(name, type);

    for (let methodname of Object.getOwnPropertyNames(type.prototype)) {
        if (methodname === 'constructor') {
            continue;
        }
        const original = type.prototype[methodname];
        type.prototype[methodname] = function() {
            console.log(`Called data layer method ${methodname} for layer ${this.constructor.name}`);
            return original.apply(this, arguments);
        };
    }
}


export default registry;
