let db;

function DB() {
  if (db) {
    return db;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyCVXN258U46GfHncJ-L7SOqWRcouDqtEwE",
    authDomain: "utsekamichael.firebaseapp.com",
    projectId: "utsekamichael",
    storageBucket: "utsekamichael.appspot.com",
    messagingSenderId: "712243975379",
    appId: "1:712243975379:web:8ce13ffb6fa8f51be0b026"
  };

  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();

  return db;
}

/**
 * @param {string} text 
 */
function alertv2(text) {
  alert(text);
  throw {};
}

/**
 * @param {string} text 
 * @param {string} fieldName
 * @param {number} min 
 * @param {number} max 
 */
function validateString(text, fieldName, min, max) {
  if (typeof text !== 'string') {
    alertv2(`${fieldName} bukan bertipe string`);
  }

  if (text.length < min || text.length > max) {
    alertv2(`panjang teks ${fieldName} harus lebih besar dari ${min} dan lebih kecil dari ${max}`);
  }
}

function parseFirebaseResult(queryResult) {
  if (!queryResult.forEach) {
    queryResult = [queryResult];
  }

  const data = [];

  queryResult.forEach(qr => {
    data.push({
      id: qr.id,
      ...qr.data(),
    });
  });

  return data;
}

async function Login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  validateString(username, 'username', 4, 16);
  validateString(password, 'password', 4, 16);
  
  const users = parseFirebaseResult(await DB().
    collection('users').
    where('username', '==', username).
    get()
  );

  if (users.length <= 0) {
    alertv2('username tidak ada');
  }

  if (users[0].password != password) {
    alertv2('password salah');
  }

  Cookies.set('user-id-session', users[0].id);
  window.location = '/main.html';
}

async function Register() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const phone = document.getElementById('phone').value;
  const email = document.getElementById('email').value;
  const address = document.getElementById('address').value;

  validateString(username, 'username', 4, 16);
  validateString(password, 'password', 4, 16);
  validateString(email, 'email', 4, 16);

  const users = parseFirebaseResult(await DB().
    collection('users').
    where('username', '==', username).
    get()
  );

  if (users.length > 0) {
    alertv2('Maaf username ini sudah pernah mendaftar sebelumny');
  }

  try {
    await DB().
    collection('users').
    add({
      username,
      password,
      phone,
      email,
      address,
    });

    alertv2('Akun sudah terdaftar silahkan login.');
  } catch (error) {
    alertv2('muncul error dengan pesan: '+error);
  }
}

async function Logout() {
  Cookies.remove('user-id-session');
}

async function CheckUserSession() {
  const session = Cookies.get('user-id-session');

  if (typeof session !== 'string') {
    alert('Tolong login terlebih dahulu');
    window.location = '/';
  }
}

/**
 * @typedef {Object} Item
 * @property {string} name
 * @property {number} price
 * 
 * @returns {Promise<{[key: string]: Item[]}>}
 */
async function GetAllItems() {
  const groupedItems = {};

  const items = parseFirebaseResult(await DB().
    collection('items').
    get()
  );

  items.forEach(item => {
    if (!groupedItems[item.category]) {
      groupedItems[item.category] = [];
    }

    groupedItems[item.category].push({
      name: item.name,
      price: item.price
    });
  });

  return groupedItems;
}

const itemWithCount = {};

function AddCount(itemID) {
  if (!itemWithCount[itemID]) {
    itemWithCount[itemID] = 0;
  }

  itemWithCount[itemID] += 1;
  updateCountText(itemID);
}

function SubCount(itemID) {
  if (!(itemWithCount[itemID] > 0)) {
    return;
  }  

  itemWithCount[itemID] -= 1;
  updateCountText(itemID);
}

function updateCountText(itemID) {
  if (!(itemWithCount[itemID] >= 0)) {
    console.log('error trying to set text but with undefined value in item id: '+itemID)
    return;
  }

  const elementID = `${itemID}-count`;
  const element = document.getElementById(elementID);

  element.innerText = itemWithCount[itemID];
}

async function AddToCart() {
  const sessionID = Cookies.get('user-id-session');
  const items = Object.entries(itemWithCount).map(item => {
    if (item[1] <= 0) {
      return;
    }

    const itemName = item[0].replace(/-/g, " ");

    return {
      id: item[0],
      name: itemName,
      count: item[1],
    }
  }).filter(i => i !== undefined);

  if (items.length <= 0) {
    alertv2("tolong pilih barang mana yang akan dibeli, sebelum melanjutkan");
  }

  const addResp = await DB().collection('carts').add({
    userID: sessionID,
    items,
    date: new Date(),
  });

  Cookies.set('latest-transaction-id', addResp.id);
  window.location = '/payment.html';
}

async function GetProductFromCart() {
  const cartsID = Cookies.get('latest-transaction-id');
  const items = parseFirebaseResult(await DB().
    collection('carts').
    doc(cartsID).
    get(),
  );

  if (items.length <= 0 || typeof cartsID !== 'string') {
    alert('tolong tambahkan product ke dalam keranjang terlebih dahulu');
    window.location = '/order.html';
  }

  return items[0];
}

/**
 * @param {string} balance 
 */
function FormatRupiah(balance) {
  if (typeof balance !== 'string') {
    balance = `${balance}`;
  }

  const lengthBalance = balance.length
  const splitedBalance = balance.split("").reverse();

  let formatedBalance = "";
  let counter = 0;

  while (lengthBalance - counter > 1) {
    formatedBalance = splitedBalance[counter] + formatedBalance;
    ++counter;

    if (counter % 3 == 0) {
      formatedBalance = "." + formatedBalance;
    }
  }

  formatedBalance = balance.substring(0, lengthBalance - counter) + formatedBalance;

  return formatedBalance + ',00';
}

async function Payment(totalPrice, reserveDate, cartID) {
  const sessionID = Cookies.get('user-id-session');
  const expressCheckbox = document.getElementById("flexCheckDefault");
  const paymentMethod = document.getElementById('payment-method');

  if (['OVO', 'BCA', 'GO-PAY'].indexOf(paymentMethod.value) === -1) {
    alertv2('tolong pilih metode pembayaran yang tersedia');
  }

  try {
    await DB().
      collection('payments').
      add({
        userID: sessionID,
        cartID,
        paymentMethod: paymentMethod.value,
        price: totalPrice,
        shipmentType: expressCheckbox.checked ? 'Express' : 'Regular',
        reserveDate: reserveDate,
        paymentDate: new Date(),
      });

    alert('Terima kasih sudah memesan, barang akan segera dikirimkan');
    Cookies.remove('latest-transaction-id');
    await DB().collection('carts').doc(cartID).delete();
    window.location = '/history.html';
  } catch (error) {
    alertv2('muncul error dengan pesan: '+error);
  }
}

async function GetPaymentList() {
  const sessionID = Cookies.get('user-id-session');

  const payments = parseFirebaseResult(await DB().
    collection('payments').
    where('userID', '==', sessionID).
    get(),
  );

  return payments.map(p => {
    return {
      id: p.id,
      paymentDate: new Date(p.paymentDate.seconds * 1000),
      reserveDate: new Date(p.reserveDate.seconds * 1000),
      shipmentType: p.shipmentType,
      shippedDate: p.shippedDate ? new Date(p.shippedDate.seconds * 1000) : null,
      price: p.price,
      paymentMethod: p.paymentMethod
    };
  });
}


async function UpdateShipped(paymentID) {
  await DB().
    collection('payments').
    doc(paymentID).
    update({
      shippedDate: new Date()
    });
  
  alert('Status pengiriman diupdate ke terkirim');
  window.location = '/history.html';
}


