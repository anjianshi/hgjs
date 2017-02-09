/* eslint-env browser */

// 从 query string 中提取指定 name 的值。
// from: http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
export function queryString(name) {
    name = name.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}
