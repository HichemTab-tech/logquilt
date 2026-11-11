import {test,expect} from '@playwright/test';
import {fixture} from './fixture.mjs';
async function open(page,text=fixture()) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'example.jsonl',mimeType:'application/json',buffer:Buffer.from(text)});
  await expect(page.getByRole('main')).toHaveAttribute('data-filename','example.jsonl');
}
test('shows a read-only CLI transcript with collapsed tool results and no controls',async({page})=>{
  await open(page);
  await expect(page.getByText('Can you check the test suite and update the greeting?',{exact:true})).toBeVisible();
  await expect(page.getByText('Bash(npm test)',{exact:true})).toBeVisible();
  await expect(page.getByText('secret-search-target',{exact:true})).not.toBeVisible();
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Back to home'})).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByText(/ctrl\+o|for shortcuts/i)).toHaveCount(0);
});
test('scrolls through a large conversation to its final message',async({page})=>{
  const rows=Array.from({length:1000},(_,i)=>JSON.stringify({type:'user',uuid:`u${i}`,message:{content:`Message ${i}`}}));
  await open(page,[fixture(),...rows].join('\n'));
  await expect(page.getByText('Message 999',{exact:true})).toHaveCount(0);
  for(let i=0;i<5;i++){await page.getByRole('main').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(100);}
  await expect(page.getByText('Message 999',{exact:true})).toBeVisible();
  expect(await page.locator('[data-entry-id]').count()).toBeLessThan(80);
  await page.getByRole('main').evaluate(e=>e.scrollTop=0);
  await expect(page.getByText('Can you check the test suite and update the greeting?',{exact:true})).toBeVisible();
});
test('does not run HTML, create active links or load remote images',async({page})=>{
  const requests=[];page.on('request',r=>{if(r.url().startsWith('https://'))requests.push(r.url());});
  const text=JSON.stringify({type:'assistant',uuid:'x',message:{content:[{type:'text',text:'<img src=x onerror="window.pwned=true">\n\n![tracking](https://example.com/tracker)\n\n[bad](javascript:alert(1))'}]}});
  await open(page,text);
  await expect(page.locator('img')).toHaveCount(0);
  await expect(page.locator('a')).toHaveCount(0);
  expect(await page.evaluate(()=>window.pwned)).toBeUndefined();expect(requests).toEqual([]);
});
test('reports invalid files and recovers with a valid conversation',async({page})=>{
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'bad.jsonl',mimeType:'application/json',buffer:Buffer.from('bad data')});
  await expect(page.getByRole('alert')).toContainText('No conversation messages');
  await page.locator('input[type=file]').setInputFiles({name:'example.jsonl',mimeType:'application/json',buffer:Buffer.from(fixture())});
  await expect(page.getByRole('main')).toHaveAttribute('data-filename','example.jsonl');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('fits narrow screens without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('starts at an upload home page and opens the chosen file from its button',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Your conversations, back in the terminal.'})).toBeVisible();
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Upload JSONL'}).click();
  await (await chooser).setFiles({name:'uploaded.jsonl',mimeType:'application/json',buffer:Buffer.from(fixture())});
  await expect(page.getByRole('main')).toHaveAttribute('data-filename','uploaded.jsonl');
  await expect(page).toHaveURL(/#conversation$/);
});

test('returns home, resumes, and replaces a same-named file without uploading its contents',async({page})=>{
  const writes=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  await open(page);
  await page.getByRole('button',{name:'Back to home'}).click();
  await expect(page.getByRole('button',{name:/Continue reading/})).toBeVisible();
  await page.getByRole('button',{name:/Continue reading/}).click();
  await expect(page.getByRole('main')).toHaveAttribute('data-filename','example.jsonl');
  await page.goBack();
  await expect(page.getByRole('button',{name:'Upload JSONL'})).toBeVisible();
  const text=JSON.stringify({type:'user',uuid:'replacement',message:{content:'A different uploaded conversation'}});
  await page.locator('input[type=file]').setInputFiles({name:'example.jsonl',mimeType:'application/json',buffer:Buffer.from(text)});
  await expect(page.getByText('A different uploaded conversation')).toBeVisible();
  await expect(page.getByText('Can you check the test suite and update the greeting?',{exact:true})).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('opens dropped JSONL files and rejects unsupported files with a retry',async({page})=>{
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('not a transcript')});
  await expect(page.getByRole('alert')).toContainText('.jsonl');
  const transfer=await page.evaluateHandle(text=>{const transfer=new DataTransfer();transfer.items.add(new File([text],'dropped.jsonl',{type:'application/json'}));return transfer;},fixture());
  await page.getByTestId('drop-zone').dispatchEvent('drop',{dataTransfer:transfer});
  await expect(page.getByRole('main')).toHaveAttribute('data-filename','dropped.jsonl');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('offers the configured example without fetching it until requested',async({page})=>{
  let transcriptRequests=0;
  await page.route('**/api/session',route=>route.fulfill({json:{available:true,name:'configured.jsonl',size:2048}}));
  await page.route('**/api/transcript',route=>{transcriptRequests++;return route.fulfill({body:fixture(),contentType:'application/x-ndjson'});});
  await page.goto('/');
  await expect(page.getByRole('button',{name:/Open example conversation/})).toBeVisible();
  expect(transcriptRequests).toBe(0);
  await page.getByRole('button',{name:/Open example conversation/}).click();
  await expect(page.getByRole('main')).toHaveAttribute('data-filename','configured.jsonl');
  expect(transcriptRequests).toBe(1);
});

test('home page fits a phone screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.getByRole('button',{name:'Upload JSONL'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
