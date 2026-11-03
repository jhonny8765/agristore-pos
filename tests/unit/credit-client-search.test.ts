import {expect,it} from 'vitest';
import {matchesCreditClient} from '../../apps/web/lib/credit-client-search';
const client={name:'Niño Northern Agro Supply',phone:'+63 (917) 123-4567'};
it('searches all words in a name without case or accent sensitivity',()=>{
 for(const q of ['','   ','NIÑO','nino','northern agro','supply northern'])expect(matchesCreditClient(client,q)).toBe(true);
 expect(matchesCreditClient(client,'nino south')).toBe(false);
});
it('matches formatted, local and country-code Philippine phone numbers',()=>{
 for(const q of ['09171234567','0917','+63 917 123 4567','917123','123-4567'])expect(matchesCreditClient(client,q)).toBe(true);
 expect(matchesCreditClient({...client,phone:'0917-123-4567'},'+639171234567')).toBe(true);
 expect(matchesCreditClient(client,'09999999999')).toBe(false);
});
it('does not turn arbitrary name digits or empty phone punctuation into a match',()=>{
 expect(matchesCreditClient(client,'wrong 917')).toBe(false);expect(matchesCreditClient(client,'+')).toBe(false);expect(matchesCreditClient({...client,phone:''},'0')).toBe(false);
});
