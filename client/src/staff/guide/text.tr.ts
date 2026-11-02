import type { GuideText } from "./text";

export const guideTextTr: GuideText = {
  categories: {
    access: {
      title: "Erişim ve oturum",
      summary: "Profil, rol görünümü, şube ve bildirimler.",
    },
    setup: {
      title: "Okul ayarları",
      summary: "Şubeler, bölümler, nedenler, özel alanlar ve Moodle.",
    },
    jotform: {
      title: "Jotform başvuruları",
      summary: "Formları bağlayın ve gelen yanıtları okuyun.",
    },
    staff: {
      title: "Personel hesapları",
      summary: "Personel ekleyin, düzenleyin ve hesapları yönetin.",
    },
    leads: {
      title: "Adaylar",
      summary: "İlk görüşmeden öğrenciye dönüşüme kadar.",
    },
    bookings: {
      title: "Randevular",
      summary: "Seviye sınavları ve deneme dersleri.",
    },
    students: {
      title: "Öğrenciler",
      summary: "Kayıtlar, sorumlu kişi, belgeler ve ilerleme.",
    },
    enrolments: {
      title: "Kayıtlar",
      summary: "Kurs satışları, ödemeler ve sınıfa yerleştirme.",
    },
    classes: {
      title: "Sınıflar",
      summary: "Sınıflar, dersler, yoklama ve haftalık plan.",
    },
    rooms: { title: "Derslikler", summary: "Derslikler ve haftalık uygunluk." },
    forms: {
      title: "Nile Forms",
      summary: "Form oluşturun, yayınlayın ve yanıtları adaylara dönüştürün.",
    },
    reports: {
      title: "Raporlar",
      summary: "Raporları inceleyin ve satırları dışa aktarın.",
    },
  },
  scenarios: {
    "manage-own-profile": {
      title: "Profilinizi yönetin",
      summary: "Bilgilerinizi, parolanızı ve oturumlarınızı kontrol edin.",
      steps: [
        {
          title: "Profili açın",
          body: "Kenar çubuğunun altındaki hesap menüsünden Profil'i açın. Adınız, e-postanız ve atanmış rolünüz burada görünür.",
        },
        {
          title: "Parolayı değiştirin",
          body: "Mevcut parolanızı ve yeni parolayı iki kez girip parola değiştirme düğmesini kullanın.",
        },
        {
          title: "Oturumları inceleyin",
          body: "Tanımadığınız etkin oturumları kapatın veya Her yerden çıkış yap'ı kullanın.",
        },
      ],
      notes: [],
    },
    "act-as-a-lower-role": {
      title: "Başka bir rol olarak görüntüleyin",
      summary: "Çıkış yapmadan daha düşük yetkili bir role geçin.",
      steps: [
        {
          title: "Rolü seçin",
          body: "Hesap menüsünde Rol olarak görüntüle'yi açıp rolü seçin.",
        },
        {
          title: "Kapsamı ayarlayın",
          body: "Üstteki rol göstergesinden şube, bölüm veya sınıfları sınırlandırıp Uygula'yı kullanın.",
        },
        {
          title: "Geri dönün",
          body: "Göstergedeki X ile kendi rolünüze dönün veya menüden kendi rolünüzü seçin.",
        },
      ],
      notes: [
        "Değişiklikler dahil tüm işlemler görüntülenen rolün erişimi ve kapsamıyla yürütülür.",
        "Yalnızca daha düşük roller sunulur. Süper Yönetici, Şube Yöneticisi, Müdür Yardımcısı ve Bölüm Başkanı kullanabilir.",
      ],
    },
    "switch-branch-workspace": {
      title: "Şube çalışma alanını değiştirin",
      summary: "Listeler ve yeni kayıtlar için çalışacağınız şubeyi seçin.",
      steps: [
        {
          title: "Şube seçimini açın",
          body: "Şube Yöneticisi, Müdür Yardımcısı, Kayıt Sorumlusu ve SSA girişten sonra şube seçer.",
        },
        {
          title: "Şubeyi seçin",
          body: "Seçtiğiniz şube listelere, yeni kayıtlara ve panele uygulanır.",
        },
        {
          title: "Sonra değiştirin",
          body: "Kenar çubuğunun altında, adınızın üzerindeki çalışma alanı seçicisini kullanın.",
        },
      ],
      notes: [
        "Süper Yönetici tüm şubelerle çalışır ve çalışma alanı seçicisi görmez.",
      ],
    },
    "read-notifications": {
      title: "Bildirimleri okuyun",
      summary: "Okunmamış bildirimleri bulun ve listenizi temizleyin.",
      steps: [
        {
          title: "Bildirimleri açın",
          body: "Ana sayfa altındaki Bildirimler'de okunmamış sekmesini seçin.",
        },
        {
          title: "Okundu işaretleyin",
          body: "Tümünü okundu yap hiçbir şey silmeden okunmamış durumunu kaldırır. Tek bir bildirimi de işaretleyebilirsiniz.",
        },
        {
          title: "Listeyi temizleyin",
          body: "Tümünü sil işlemini onaylayın. Yalnızca size ait kopyalar silinir.",
        },
      ],
      notes: [],
    },
    "add-a-branch": {
      title: "Şube ekleyin",
      summary: "Adaylar, öğrenciler ve sınıflar için şube oluşturun.",
      steps: [
        {
          title: "Şubeleri açın",
          body: "Kişiler ve yerler altında Şubeler'i açıp şube ekleme düğmesini kullanın.",
        },
        {
          title: "Bilgileri girin",
          body: "Ad, kod, saat dilimi ve çevrimiçi şube seçimini girip oluşturun.",
        },
        {
          title: "Personeli atayın",
          body: "İlgili personelin şube kapsamına yeni şubeyi ekleyin.",
        },
      ],
      notes: [],
    },
    "add-a-department": {
      title: "Bölüm ekleyin",
      summary: "Kurslar ve bölüm başkanları için bölüm oluşturun.",
      steps: [
        {
          title: "Bölümleri açın",
          body: "Kişiler ve yerler altındaki Bölümler'den yeni bölüm ekleyin.",
        },
        { title: "Adını girin", body: "Ad ve kodu girip bölümü oluşturun." },
        {
          title: "Bölümü kullanın",
          body: "Bölüm Başkanı hesabına bölümü atayın. Kursun bölümünü kurs düzenleme ekranından seçin.",
        },
      ],
      notes: [],
    },
    "manage-action-reasons": {
      title: "İşlem nedenlerini yönetin",
      summary: "İptal, ayrılma ve devre dışı bırakma nedenlerini düzenleyin.",
      steps: [
        {
          title: "Nedenleri açın",
          body: "Ayarlar altında İşlem nedenleri'ni açın; tür filtresiyle listeyi seçin.",
        },
        {
          title: "Ekleyin veya düzenleyin",
          body: "Yeni neden ekleyin veya satırdaki düzenleme işlemini kullanın. CSV ile toplu içe aktarabilirsiniz.",
        },
        {
          title: "Kullanılmayanı kapatın",
          body: "Silmek yerine devre dışı bırakın.",
        },
      ],
      notes: [
        "Devre dışı nedenler yeni işlemlerde gizlenir. Yeniden etkinleştirebilirsiniz.",
      ],
    },
    "set-up-areas-of-study": {
      title: "Çalışma alanlarını ayarlayın",
      summary: "Öğrencilerin yerleştirilebileceği alanları yönetin.",
      steps: [
        {
          title: "Alanları açın",
          body: "Ayarlar altındaki Çalışma alanları'ndan yeni alan ekleyin.",
        },
        {
          title: "Bilgileri girin",
          body: "Ad, sıralama ve seviye sınavlarını içeren Moodle kurslarını seçin. Sonradan satırı düzenleyebilirsiniz.",
        },
        {
          title: "Kullanılmayanı kapatın",
          body: "Artık sunmadığınız alanı silmek yerine devre dışı bırakın.",
        },
      ],
      notes: [],
    },
    "add-a-custom-field": {
      title: "Özel alan ekleyin",
      summary: "Kayıtlara ihtiyacınız olan ek bilgileri ekleyin.",
      steps: [
        {
          title: "Özel alanları açın",
          body: "Ayarlar altında Özel alanlar'ı açıp yeni alan ekleyin.",
        },
        {
          title: "Kaydı ve türü seçin",
          body: "Personel profili, öğrenci veya şube gibi bir varlık seçin. Alan anahtarını, türünü ve adını girin.",
        },
        {
          title: "Seçenekleri ayarlayın",
          body: "Seçim alanlarında her satıra bir seçenek yazın. Gerekirse zorunlu yapıp alanı oluşturun.",
        },
      ],
      notes: ["Alan anahtarı oluşturulduktan sonra değiştirilemez."],
    },
    "connect-moodle": {
      title: "Moodle sitesini bağlayın",
      summary: "Kurslar, gruplar ve yoklama için Moodle bağlantısını kurun.",
      steps: [
        { title: "Moodle'ı açın", body: "Sistem altında Moodle'ı açın." },
        {
          title: "Bağlantıyı girin",
          body: "Site adresini ve web hizmeti anahtarını girip Moodle bağlantısını kurun.",
        },
        {
          title: "Bağlantıyı sınayın",
          body: "Bağlantı testini çalıştırın. Durum kartında erişilebilirlik ve beklenen sürümü kontrol edin.",
        },
      ],
      notes: [
        "Bağlantıyı kesmek kayıtlı anahtarı kaldırır. Yeniden bağlanana kadar kurslar ve gruplar eşitlenmez.",
      ],
    },
    "link-a-course": {
      title: "Moodle kursunu bağlayın",
      summary: "Moodle kataloğundaki bir kursu ekleyin.",
      steps: [
        {
          title: "Kursları açın",
          body: "Eğitim altında Kurslar'ı açıp Moodle kursu bağlama işlemini seçin.",
        },
        {
          title: "Kursu seçin",
          body: "Kategoriyle filtreleyin veya arayın. Henüz bağlanmamış bir Moodle kursu seçin.",
        },
        {
          title: "Bilgileri tamamlayın",
          body: "Bölümü ve toplam ders saatini seçip kursu bağlayın.",
        },
      ],
      notes: ["Liste eskiyse Moodle'dan yenileme düğmesini kullanın."],
    },
    "check-system-health": {
      title: "Sistem durumunu kontrol edin",
      summary: "Arka uç hizmetlerine erişimi inceleyin.",
      steps: [
        { title: "Durumu açın", body: "Sistem altında Sistem durumu'nu açın." },
        {
          title: "Sonuçları okuyun",
          body: "API, veritabanı, şema, geçişler ve Moodle durumlarını inceleyin. Yenile ile yeniden kontrol edin.",
        },
      ],
      notes: [],
    },
    "register-a-form": {
      title: "Jotform formu bağlayın",
      summary: "Form yanıtlarının EMS'ye ulaşmasını sağlayın.",
      steps: [
        {
          title: "Jotform'u açın",
          body: "Sistem altında Jotform'u açıp form bağlama işlemini seçin.",
        },
        {
          title: "Form kimliğini girin",
          body: "Sayısal kimliği veya Jotform bağlantısını yapıştırın. Form adı Jotform'dan kontrol edilir.",
        },
        {
          title: "Oluşturulacak kaydı seçin",
          body: "Aday, aday ve seviye sınavı veya aday ve deneme dersi seçin. Yedek şubeyi belirleyip bağlayın.",
        },
      ],
      notes: [
        "EMS ekibi Jotform webhook bağlantısını yapılandırmadan yanıtlar ulaşmaz.",
      ],
    },
    "map-form-fields": {
      title: "Form alanlarını eşleştirin",
      summary: "EMS bilgileriyle Jotform sorularını eşleştirin.",
      steps: [
        {
          title: "Formu açın",
          body: "Jotform listesinden formun ayarlarını açın.",
        },
        {
          title: "Soruları eşleştirin",
          body: "Her EMS girdisinin yanına ilgili Jotform sorusunun benzersiz adını yazıp kaydedin.",
        },
        {
          title: "Alımı açın",
          body: "Tüm zorunlu girdiler eşleşince yanıt alımını etkinleştirin.",
        },
      ],
      notes: ["Tüm zorunlu girdiler eşleşmeden alım açılamaz."],
    },
    "receive-a-submission": {
      title: "Gelen yanıtı kontrol edin",
      summary: "Yeni Jotform yanıtlarının kaydedildiğini doğrulayın.",
      steps: [
        {
          title: "Yanıtları açın",
          body: "Jotform satırından veya form ayarlarından gönderimleri açın.",
        },
        {
          title: "Yeni satırları izleyin",
          body: "Her gelen yanıt alındığı zamanla listelenir.",
        },
      ],
      notes: [
        "Yanıt gelmiyorsa önce EMS ekibinden webhook bağlantısını kontrol etmesini isteyin.",
      ],
    },
    "read-a-submission": {
      title: "Bir yanıtı okuyun",
      summary: "Gönderilen soruları ve yanıtları inceleyin.",
      steps: [
        {
          title: "Satırı açın",
          body: "Formun gönderimler listesinden bir satır seçin.",
        },
        {
          title: "Yanıtları inceleyin",
          body: "Soruların yanıtlarını okuyun. E-postayla aday arayabilir veya Jotform'da açabilirsiniz.",
        },
      ],
      notes: [],
    },
    "invite-staff": {
      title: "Personel ekleyin",
      summary: "Davet bağlantısı veya geçici parolayla hesap oluşturun.",
      steps: [
        {
          title: "Personeli açın",
          body: "Kişiler ve yerler altında Personel'den yeni kişi ekleyin.",
        },
        {
          title: "Hesabı doldurun",
          body: "Ad, soyad, e-posta ve rolü girin. Davet bağlantısı veya elle parola oluşturmayı seçin.",
        },
        {
          title: "Kapsamı belirleyin",
          body: "Şube kapsamını seçip oluşturun. Tek kullanımlık bağlantıyı veya parolayı güvenli biçimde paylaşın.",
        },
      ],
      notes: [
        "Şube Yöneticisi Müdür Yardımcısı ve daha düşük rolleri; Müdür Yardımcısı Bölüm Başkanı, Kayıt Sorumlusu, SSA ve Öğretmen ekler.",
      ],
    },
    "edit-staff": {
      title: "Personeli düzenleyin",
      summary: "İletişim bilgilerini, kapsamı veya rolü güncelleyin.",
      steps: [
        {
          title: "Kişiyi bulun",
          body: "Personel sayfasında kişiyi açıp düzenleyin. Liste satırının menüsü de kullanılabilir.",
        },
        {
          title: "Bilgileri değiştirin",
          body: "Ad, e-posta, iletişim veya şube kapsamını değiştirip kaydedin.",
        },
        {
          title: "Sonucu kontrol edin",
          body: "Kaydedilen bilgileri personel detayında doğrulayın.",
        },
      ],
      notes: [
        "Şube Yöneticisi Müdür Yardımcısı ve altını; Müdür Yardımcısı Bölüm Başkanı, Kayıt Sorumlusu, SSA ve Öğretmen'i yönetir.",
        "Rolü veya Bölüm Başkanı'nın bölümlerini yalnızca Süper Yönetici değiştirebilir.",
      ],
    },
    "reset-or-disable-staff": {
      title: "Personel parolasını sıfırlayın veya hesabını kapatın",
      summary: "Geçici parola oluşturun veya hesabı devre dışı bırakın.",
      steps: [
        {
          title: "İşlemleri açın",
          body: "Personeli açıp diğer işlemler menüsüne gidin.",
        },
        {
          title: "Parola oluşturun",
          body: "Parola belirleme işleminin ürettiği geçici parolayı tek kullanımlık bilgilerden kopyalayıp güvenle paylaşın.",
        },
        {
          title: "Kapatın veya açın",
          body: "Neden seçerek devre dışı bırakın. Etkinleştirmek yeniden girişe izin verir.",
        },
      ],
      notes: [
        "Kendi hesabınızı bu menüden sıfırlayamaz veya devre dışı bırakamazsınız.",
      ],
    },
    "bind-staff-moodle": {
      title: "Personeli Moodle'a bağlayın",
      summary: "Personel hesabını Moodle hesabıyla ilişkilendirin.",
      steps: [
        {
          title: "Hesabı açın",
          body: "Personelin diğer işlemler menüsünden Moodle hesabını seçin.",
        },
        {
          title: "Oluşturun veya bağlayın",
          body: "Yeni Moodle hesabı oluşturun veya mevcut hesabı arayıp bağlayın; ardından onaylayın.",
        },
      ],
      notes: [],
    },
    "set-up-a-teacher": {
      title: "Öğretmeni hazırlayın",
      summary: "Kursları, uygunluğu ve seviye sınavı yetkisini ayarlayın.",
      steps: [
        {
          title: "Hesabı açın",
          body: "Öğretmen rolü ve şube kapsamıyla hesap ekleyin veya mevcut öğretmeni açın.",
        },
        {
          title: "Kursları seçin",
          body: "Kurslar sekmesinde öğretmenin verebileceği kursları seçin.",
        },
        {
          title: "Saatleri ve sınav hakkını ayarlayın",
          body: "Uygunluk sekmesinde saatleri boyayın. Düzenleme ekranından seviye sınavı hakkını belirleyin.",
        },
      ],
      notes: [
        "Seviye sınavı anahtarı yalnızca Öğretmen içindir. Bölüm Başkanı ve Müdür Yardımcısı her zaman uygundur.",
        "Bölümler yalnızca Bölüm Başkanı hesaplarına atanır; öğretmenler kurslara atanır.",
      ],
    },
    "add-a-lead": {
      title: "Aday ekleyin",
      summary: "Yeni bir kişinin ilk kaydını oluşturun.",
      steps: [
        {
          title: "Adayları açın",
          body: "Kabul altında Adaylar'dan yeni aday ekleyin.",
        },
        {
          title: "Bilgileri doldurun",
          body: "Ad, e-posta, iletişim, cinsiyet ve şubeyi girin. Kaydetmeden önce eşleşmeleri kontrol edin.",
        },
        {
          title: "Kaydedin ve ilerleyin",
          body: "Adayı oluşturun. Sonraki adım kartı yapılacak işi gösterir.",
        },
      ],
      notes: ["Adayda SSA seçilmez. Kayıt Sorumlusu ataması otomatik yapılır."],
    },
    "work-a-lead": {
      title: "Aday sürecini ilerletin",
      summary: "İlk görüşmeden öğrenci kaydına kadar sonraki adımı izleyin.",
      steps: [
        {
          title: "Adayı açın",
          body: "İlk görüşme, seviye sınavı, deneme dersi, kayıt ücreti ve öğrenci aşamalarını inceleyin.",
        },
        {
          title: "Sonraki adımı uygulayın",
          body: "Kartın sunduğu işlemi tamamlayın veya isteğe bağlı sınavı ya da denemeyi atlayın.",
        },
        {
          title: "Bilgileri güncel tutun",
          body: "Notları ve takip durumunu güncelleyin. Tamamlanan işlemler sonraki adımı değiştirir.",
        },
      ],
      notes: [
        "Kayıt Sorumlusu adaylarla çalışır; SSA'nın kabul sayfalarına erişimi yoktur.",
      ],
    },
    "use-the-pipeline-board": {
      title: "Aday panosunu kullanın",
      summary: "Adayları aşamalar arasında taşıyın.",
      steps: [
        {
          title: "Panoyu açın",
          body: "Adaylar sayfasındaki görünüm seçicisinden panoyu açın.",
        },
        {
          title: "Kartı taşıyın",
          body: "Kartı sürükleyin veya taşıma menüsünü kullanın. Sınav ve deneme aşamaları randevu formunu açar.",
        },
        {
          title: "Toplu işlem yapın",
          body: "Kartları seçip süreçte, takip, gelecekte kayıt veya kayıp aşamasına topluca taşıyın.",
        },
      ],
      notes: [
        "Kayıtlı aşamasına sürüklenemez. Aday öğrenciye dönüştüğünde kayıtlı olur.",
      ],
    },
    "manage-lead-groups": {
      title: "Aday gruplarını görün",
      summary: "Birbirine bağlı adayları bulun.",
      steps: [
        {
          title: "Grup sütununa bakın",
          body: "Adaylar listesindeki grup sütunu bağlı grubu gösterir.",
        },
        {
          title: "Üyeyi açın",
          body: "Gruplu adayın detayında diğer üyeleri ve ana kişiyi görün.",
        },
        {
          title: "Üyeler arasında geçin",
          body: "Bir üyenin adına basarak kaydını açın.",
        },
      ],
      notes: [],
    },
    "mark-a-lead-lost": {
      title: "Adayı kayıp işaretleyin",
      summary: "Nedenle kapatın, gerekirse yeniden açın.",
      steps: [
        {
          title: "İşlemi seçin",
          body: "Adayın diğer işlemler menüsünü kullanın veya kartını kayıp aşamasına bırakın.",
        },
        {
          title: "Nedeni seçin",
          body: "Ayarlar altındaki Kayıp nedenleri listesinden neden seçip onaylayın.",
        },
        {
          title: "Gerekirse yeniden açın",
          body: "Diğer işlemlerden adayı yeniden açın. Kayıp aşaması tüm kapatılan adayları gösterir.",
        },
      ],
      notes: [
        "Kayıp nedenleri Kabul raporunda yer alır.",
        "Yeniden açmak adayı süreçte aşamasına döndürür.",
      ],
    },
    "check-for-duplicates": {
      title: "Yinelenen kayıtları kontrol edin",
      summary: "Aynı kişiyi yeniden oluşturmadan eşleşmeleri inceleyin.",
      steps: [
        {
          title: "Bilgileri yazın",
          body: "Aday veya öğrenci eklerken ad ve e-posta eşleşmeleri otomatik aranır.",
        },
        {
          title: "Eşleşmeyi açın",
          body: "Mevcut kayıt uyarısında Aç ile kişiyi inceleyin.",
        },
      ],
      notes: [
        "Başka adayda kullanılan e-posta kaydetmeyi engeller. Diğer eşleşmeler uyarır; yine de oluşturabilirsiniz.",
      ],
    },
    "convert-a-lead": {
      title: "Adayı öğrenciye dönüştürün",
      summary: "Kayıt ücreti girildikten sonra öğrenci hesabı oluşturun.",
      steps: [
        {
          title: "Dönüşüme gelin",
          body: "Kayıt ücretini kaydedin. Sonraki adım kartı öğrenci oluşturmayı sunar.",
        },
        {
          title: "Kimliği kontrol edin",
          body: "Uyruk, adres, cinsiyet, doğum tarihi ve kimlik veya pasaportu girin. 18 yaşından küçükler için veli ekleyin.",
        },
        {
          title: "SSA'yı seçin",
          body: "Sorumlu alanı görünüyorsa SSA seçin veya sorumlusuz bırakın.",
        },
        {
          title: "Öğrenciyi oluşturun",
          body: "Oluşturduktan sonra öğrenci sayfası açılır. Önerilen kurs varsa satış hazırdır.",
        },
      ],
      notes: [
        "Dönüşümde SSA'yı yalnızca Süper Yönetici, Şube Yöneticisi veya Müdür Yardımcısı seçer.",
        "Kayıt Sorumlusu dönüşümde sorumlu alanını görmez.",
      ],
    },
    "schedule-a-placement-test": {
      title: "Seviye sınavı planlayın",
      summary: "Aday veya öğrenci için randevu oluşturun.",
      steps: [
        {
          title: "Kişiden başlayın",
          body: "Adayın sonraki adımından veya öğrencinin sınav ve denemeler sekmesinden sınav ayırtın.",
        },
        {
          title: "Zaman ve yer seçin",
          body: "Tarih, başlangıç ve biliniyorsa çalışma alanını seçin. Yüz yüze şubede derslik, çevrimiçi şubede toplantı bağlantısı gerekir.",
        },
        {
          title: "Kaydedin",
          body: "Randevuyu kaydedin. Sonucu girilene kadar yaklaşan sınavlarda görünür.",
        },
      ],
      notes: [
        "Yüz yüze randevular derslik, çevrimiçi randevular toplantı bağlantısı gerektirir.",
      ],
    },
    "schedule-review-placement": {
      title: "Seviye sınavı talebini planlayın",
      summary: "Bekleyen talebe gerçek zaman ayırın.",
      steps: [
        {
          title: "İnceleme listesini açın",
          body: "Seviye sınavları sayfasındaki inceleme bekleyen talepleri açın.",
        },
        {
          title: "Planlayın",
          body: "Satırdan planlamayı açın; talebi, tarihi ve dersliği kontrol edip onaylayın.",
        },
      ],
      notes: [],
    },
    "record-a-placement-result": {
      title: "Seviye sınavı sonucunu girin",
      summary: "Tamamlanan sınavın sonucunu kaydedin.",
      steps: [
        {
          title: "Randevuyu açın",
          body: "Yaklaşan sınavda veya aday sayfasında sonuç kaydetme işlemini açın.",
        },
        {
          title: "Sonucu kaydedin",
          body: "Puan veya seviye, rehber öğretmen, gerekirse önerilen kurs ve notu girip kaydedin.",
        },
      ],
      notes: [],
    },
    "change-a-placement-test": {
      title: "Seviye sınavını değiştirin veya iptal edin",
      summary: "Zamanı değiştirin veya neden seçerek iptal edin.",
      steps: [
        {
          title: "Satır menüsünü açın",
          body: "Yaklaşan seviye sınavının satır menüsünü açın.",
        },
        {
          title: "Değiştirin veya iptal edin",
          body: "Yeni saat veya derslik seçip kaydedin ya da neden seçerek randevuyu iptal edin.",
        },
      ],
      notes: [],
    },
    "schedule-a-trial-lesson": {
      title: "Deneme dersi planlayın",
      summary: "Aday veya öğrenciye deneme randevusu verin.",
      steps: [
        {
          title: "Kişiden başlayın",
          body: "Adayın sonraki adımından veya öğrencinin sınav ve denemeler sekmesinden deneme ayırtın.",
        },
        {
          title: "Konuyu ve zamanı seçin",
          body: "Kurs veya çalışma alanı, tarih, saat ve derslik ya da toplantı bağlantısı seçip ayırtın.",
        },
        {
          title: "Sonucu bekleyin",
          body: "Deneme sonucu girilene kadar yaklaşanlarda kalır. Önce seviye sınavı yapılabilir veya atlanabilir.",
        },
      ],
      notes: [
        "Deneme için kurs veya çalışma alanı, yüz yüze şubede ayrıca derslik gerekir.",
      ],
    },
    "schedule-review-trial": {
      title: "Deneme talebini planlayın",
      summary: "Deneme talebini gerçek randevuya dönüştürün.",
      steps: [
        {
          title: "Talepleri açın",
          body: "Deneme dersleri sayfasındaki inceleme bekleyen sekmesini açın.",
        },
        {
          title: "Zaman ayırın",
          body: "Satırda planlamayı açıp konu, tarih ve dersliği seçerek onaylayın.",
        },
      ],
      notes: [],
    },
    "record-a-trial-result": {
      title: "Deneme sonucunu girin",
      summary: "Sonucu ve önerilen kursu kaydedin.",
      steps: [
        {
          title: "Denemeyi açın",
          body: "Yaklaşan denemede veya adayda sonuç kaydetme işlemini açın.",
        },
        {
          title: "Sonucu girin",
          body: "Puan veya seviyeyi, önerilen kursu ve notları kaydedin.",
        },
        {
          title: "Öneriyi kontrol edin",
          body: "Öğrencinin önerilen sonraki kurs panelini veya adayın sonraki adımını inceleyin.",
        },
      ],
      notes: ["Kurs satışında önerilen kurs işaretlenir."],
    },
    "work-the-review-queue": {
      title: "İnceleme kuyruğunu işleyin",
      summary: "Talepleri randevuya dönüştürün.",
      steps: [
        {
          title: "Kuyruğu bulun",
          body: "Panelde ilgilenilmesi gereken randevu taleplerinden inceleme sekmesine gidin.",
        },
        {
          title: "Planlayın veya iptal edin",
          body: "Satırı planlayın ya da satır menüsünden neden seçerek iptal edin.",
        },
        {
          title: "Listeyi temiz tutun",
          body: "Planlanan talepler yaklaşanlara geçer ve bekleyen sayısı azalır.",
        },
      ],
      notes: [
        "Talepler, adayla birlikte sınav veya deneme oluşturan Jotform formlarından gelir.",
      ],
    },
    "add-a-student": {
      title: "Öğrenci ekleyin",
      summary: "Aday süreci olmadan doğrudan öğrenci oluşturun.",
      steps: [
        {
          title: "Öğrencileri açın",
          body: "Kabul altında Öğrenciler'den yeni öğrenci ekleyin.",
        },
        {
          title: "Kimlik ve velileri girin",
          body: "Ad, e-posta, kayıt ücreti, kimlik ve veli bilgilerini girin. Süper Yönetici ana şubeyi de seçer.",
        },
        {
          title: "Kursa kaydedin",
          body: "Öğrenciyi oluşturun; açılan kaydın Kurslar sekmesinden kurs satabilirsiniz.",
        },
      ],
      notes: [
        "Mısır vatandaşları ulusal kimlik, 18 yaşından küçükler en az bir veli gerektirir.",
      ],
    },
    "assign-an-ssa": {
      title: "Öğrenciye SSA atayın",
      summary: "Öğrenci kaydının sorumlusunu seçin.",
      steps: [
        {
          title: "Öğrenciyi düzenleyin",
          body: "Öğrenciyi açıp düzenleme işlemini seçin.",
        },
        {
          title: "Sorumluyu seçin",
          body: "Sorumlu alanında SSA seçin veya atamayı kaldırın; ardından kaydedin.",
        },
      ],
      notes: [
        "Sorumluyu Süper Yönetici, Şube Yöneticisi ve Müdür Yardımcısı değiştirir. Kayıt Sorumlusu öğrenciyi düzenleyemez.",
      ],
    },
    "read-student-progress": {
      title: "Öğrencinin ilerlemesini okuyun",
      summary: "Öğrenme ve rapor sekmelerini kullanın.",
      steps: [
        {
          title: "Öğrenciyi açın",
          body: "Öğrencinin öğrenme sekmesine geçin.",
        },
        {
          title: "Moodle öğrenmesini kontrol edin",
          body: "Her sınıfın Moodle notunu ve tamamlanmasını inceleyin.",
        },
        {
          title: "Raporu okuyun",
          body: "Rapor sekmesinden akademik raporu okuyun; yazdırabilir veya dosya olarak kaydedebilirsiniz.",
        },
      ],
      notes: [],
    },
    "add-a-document": {
      title: "Öğrenciye belge ekleyin",
      summary: "Pasaport, kimlik ve ekleri yükleyin.",
      steps: [
        {
          title: "Belgeleri açın",
          body: "Öğrencinin genel bakış sekmesindeki belgeleri bulun.",
        },
        {
          title: "Yükleyin",
          body: "Yüklemeyi açıp amaç ve dosyayı seçin; ardından yükleyin.",
        },
        {
          title: "İndirin veya arşivleyin",
          body: "Satır menüsünden indirin. Öğrenciyi düzenleyebilenler arşivleyebilir.",
        },
      ],
      notes: [
        "Depolama bağlı değilse yüklemeler açıklamayla duraklar; mevcut belgeler görünür.",
        "Kayıt Sorumlusu belgeleri görüp indirebilir, yükleyemez veya arşivleyemez.",
      ],
    },
    "disable-a-student": {
      title: "Öğrenciyi devre dışı bırakın",
      summary: "Geçmişini koruyarak kaydı kapatın.",
      steps: [
        {
          title: "İşlemi açın",
          body: "Öğrencinin diğer işlemlerinden devre dışı bırakmayı seçin.",
        },
        {
          title: "Nedeni onaylayın",
          body: "Neden seçip onaylayın. Yeni kurs kaydı açılamaz.",
        },
        {
          title: "Yeniden etkinleştirin",
          body: "Kaydı görebilen yöneticiler aynı menüden yeniden etkinleştirebilir.",
        },
      ],
      notes: [
        "Geçmiş korunur. Kayıt Sorumlusu ve SSA devre dışı öğrenciyi göremez.",
        "Diğer işlemleri yöneticiler ve öğrencinin kendi SSA'sı görür.",
      ],
    },
    "sell-a-course": {
      title: "Kurs satın",
      summary: "Öğrenciye ücretli kurs kaydı açın.",
      steps: [
        {
          title: "Satışı açın",
          body: "Öğrencinin Kurslar sekmesinden veya Kayıtlar'da öğrenci arayarak satış başlatın.",
        },
        {
          title: "Kurs ve ücreti seçin",
          body: "Kurs, sınıf türü, toplam ücret ve ödenen tutarı girin.",
        },
        {
          title: "Sınıf seçin",
          body: "Sınıfı şimdi seçin veya sonraya bırakın; satışı onaylayın.",
        },
      ],
      notes: [
        "Sınıfa katılmak için tam ödeme ve Moodle hesabı gerekir. Aksi halde satış bekler.",
      ],
    },
    "record-a-payment": {
      title: "Ödeme kaydedin",
      summary: "Kurs satışının ödenen tutarını güncelleyin.",
      steps: [
        {
          title: "Satışı bulun",
          body: "Kayıtlar'daki bekleyenlerden veya öğrencinin Kurslar sekmesinden satışı bulun.",
        },
        {
          title: "Tutarı kaydedin",
          body: "Ödeme kaydetme işleminde toplamı veya ödeneni güncelleyin. Bakiye yeniden hesaplanır.",
        },
      ],
      notes: [],
    },
    "place-in-a-class": {
      title: "Öğrenciyi sınıfa yerleştirin",
      summary: "Ödenmiş satışı sınıfa dönüştürün.",
      steps: [
        {
          title: "Satışı bulun",
          body: "Bekleyen ödenmiş satışta sınıfa ekleme işlemini seçin.",
        },
        {
          title: "Sınıfı seçin",
          body: "Şubedeki uygun kurs sınıflarını ve kalan kontenjanı inceleyin. Dolu sınıf seçilemez.",
        },
        {
          title: "Onaylayın",
          body: "Sınıfa eklemeyi onaylayın; öğrenci sınıfa katılır.",
        },
      ],
      notes: [
        "Sınıfa ekleme yalnızca tam ödeme sonrası görünür.",
        "Öğrencinin Moodle hesabı olmalıdır.",
      ],
    },
    "mark-left-or-cancel": {
      title: "Satışı ayrıldı veya iptal işaretleyin",
      summary: "Erken biten satışı neden seçerek kapatın.",
      steps: [
        {
          title: "Menüyü açın",
          body: "Öğrencinin Kurslar sekmesinde veya Kayıtlar'da satır menüsünü açın.",
        },
        {
          title: "İşlemi seçin",
          body: "Ayrıldı işaretleme veya satış iptalini seçip nedenle onaylayın.",
        },
        {
          title: "Durumu kontrol edin",
          body: "Satış ayrılanlar veya iptal edilenler sekmesine geçer, geçmişte kalır.",
        },
      ],
      notes: [
        "Ayrılma yalnızca sonraki seviye satışları içindir. İptal yalnızca bekleyen satışlarda mümkündür ve geri alınamaz.",
      ],
    },
    "complete-a-level": {
      title: "Seviyeyi tamamlayın",
      summary: "Biten kurs kaydını tamamlandı işaretleyin.",
      steps: [
        {
          title: "Menüyü açın",
          body: "Kayıtlı satışın menüsünü öğrenciden veya Kayıtlar'dan açın.",
        },
        {
          title: "Tamamlayın",
          body: "Tamamlandı işlemini onaylayın. Satış tamamlananlara taşınır.",
        },
      ],
      notes: [
        "Bitirilen kurs için tamamlamayı, alınmayacak sonraki seviye için ayrılmayı kullanın.",
      ],
    },
    "create-a-class": {
      title: "Sınıf oluşturun",
      summary: "Kurs, öğretmenler, kontenjan ve tarihleri belirleyin.",
      steps: [
        {
          title: "Sınıfları açın",
          body: "Eğitim altında Sınıflar'dan yeni sınıf ekleyin.",
        },
        {
          title: "Bilgileri girin",
          body: "Kurs, tür, kontenjan, başlangıç, bitiş ve öğretmenleri seçin. Süper Yönetici şubeyi de seçer.",
        },
        {
          title: "Olağan saatleri ayarlayın",
          body: "Gün ve saatleri belirleyin, çevrimiçi sınıfa toplantı bağlantısı ekleyip oluşturun.",
        },
      ],
      notes: [],
    },
    "bind-moodle-group": {
      title: "Sınıfı Moodle grubuna bağlayın",
      summary: "Yoklama ve notlar için grubu ilişkilendirin.",
      steps: [
        {
          title: "Sınıfı açın",
          body: "Sınıfın diğer işlemlerinden Moodle grubu oluşturmayı seçin.",
        },
        {
          title: "Oluşturun veya bağlayın",
          body: "Yeni grup oluşturun veya mevcut grubu arayıp bağlayın. Ardından Moodle eşitlemesini kullanın.",
        },
      ],
      notes: [],
    },
    "propose-sessions": {
      title: "Dersleri planlayın ve ayırtın",
      summary: "Öğretmen ve derslik uygunluğundan saat bulun.",
      steps: [
        {
          title: "Dersleri açın",
          body: "Sınıfın dersler sekmesinden ders planlamayı açın.",
        },
        {
          title: "Saat bulun",
          body: "Günleri, süreleri ve tarih aralığını girip uygun saatleri bulun.",
        },
        {
          title: "Ayırtın",
          body: "Önerilen saatleri kontrol edip dersleri ayırtın.",
        },
      ],
      notes: [
        "Önerilen saatlerde öğretmen ve derslik birlikte uygun olmalıdır.",
      ],
    },
    "change-a-session": {
      title: "Dersi değiştirin veya iptal edin",
      summary: "Planlanmış dersin zamanını yönetin.",
      steps: [
        {
          title: "Dersi bulun",
          body: "Sınıfın dersler sekmesindeki yaklaşanlardan seçin.",
        },
        {
          title: "Değiştirin veya iptal edin",
          body: "Tarih, saat ve süreyi değiştirin ya da dersi iptal edin. Geçmiş ders değiştirilemez.",
        },
      ],
      notes: [],
    },
    "mark-attendance": {
      title: "Yoklama alın",
      summary: "Gerçekleşen dersin katılımını kaydedin.",
      steps: [
        {
          title: "Dersi açın",
          body: "Sınıfın yoklama sekmesini veya öğretmen olarak Haftam'ı kullanın.",
        },
        {
          title: "Yoklamayı kaydedin",
          body: "Öğrencileri tek tek veya tümünü mevcut işaretleyip yoklamayı kaydedin.",
        },
      ],
      notes: [
        "Yoklama Moodle'a kaydedilir. Kursun yoklama etkinliği önceden ayarlanmalıdır.",
      ],
    },
    "read-roster-and-grades": {
      title: "Sınıf listesini ve notları okuyun",
      summary: "Öğrencileri ve ders notlarını görün.",
      steps: [
        {
          title: "Sınıfı açın",
          body: "Öğrenciler sekmesinde sınıf listesini görün.",
        },
        {
          title: "Notları kontrol edin",
          body: "Notlar sekmesi Moodle kurs notlarını gösterir.",
        },
      ],
      notes: [],
    },
    "plan-my-week": {
      title: "Haftamı planla",
      summary: "Verdiğiniz dersleri gün gün görün.",
      steps: [
        { title: "Haftam'ı açın", body: "Eğitim altında Haftam'ı seçin." },
        {
          title: "Günleri inceleyin",
          body: "Derslerin saat, sınıf ve dersliklerini görün. Ders olmayan günler boş gösterilir.",
        },
        {
          title: "Haftayı değiştirin",
          body: "Önceki ve sonraki hafta oklarını ya da bu haftaya dönüş düğmesini kullanın.",
        },
      ],
      notes: [],
    },
    "add-a-room": {
      title: "Derslik ekleyin",
      summary: "Yüz yüze randevular ve sınıflar için derslik oluşturun.",
      steps: [
        {
          title: "Derslikleri açın",
          body: "Eğitim altında Derslikler'den yeni derslik ekleyin.",
        },
        {
          title: "Bilgileri girin",
          body: "Ad ve kontenjanı girip oluşturun. Süper Yönetici şubeyi de seçer.",
        },
        {
          title: "Saatlerini ayarlayın",
          body: "Dersliğin uygunluk çizelgesini açın. Yöneticiler ve SSA saatleri boyayabilir.",
        },
      ],
      notes: [],
    },
    "set-room-availability": {
      title: "Derslik uygunluğunu ayarlayın",
      summary: "Dersliğin ayırtılabileceği saatleri işaretleyin.",
      steps: [
        {
          title: "Dersliği açın",
          body: "Haftalık uygunluk çizelgesinde önceki hafta, bugün ve sonraki hafta ile gezinin.",
        },
        {
          title: "Saatleri boyayın",
          body: "Uygun, uygun değil veya temizle seçip saatleri boyayın. Ayırtılmış saatler kilitlidir.",
        },
        {
          title: "Kaydedin",
          body: "Değişiklikleri kaydedin. Ders planlama bu saatleri kullanır.",
        },
      ],
      notes: ["Dersler yalnızca dersliğin uygun saatlerine planlanabilir."],
    },
    "build-a-form": {
      title: "Form oluşturun",
      summary: "İhtiyacınız olan sorularla Nile Form hazırlayın.",
      steps: [
        {
          title: "Formları açın",
          body: "Ana sayfa altında Formlar'dan yeni form oluşturun.",
        },
        {
          title: "Bilgileri girin",
          body: "İngilizce ve Arapça başlık, kategori, şube ve başlangıç şablonunu seçip oluşturun.",
        },
        {
          title: "Soruları ekleyin",
          body: "Oluşturma sekmesinde soruları ekleyip taslağı kaydedin. Yayınlanana kadar form açık değildir.",
        },
      ],
      notes: [],
    },
    "publish-a-form": {
      title: "Form yayınlayın",
      summary: "Bağlantı verin veya kişilere atayın.",
      steps: [
        {
          title: "Paylaşım sekmesini açın",
          body: "Formun paylaşım sekmesinden yayınlamayı açın.",
        },
        {
          title: "Hedef kitleyi seçin",
          body: "Bağlantı adını girin. Herkes, giriş yapmış personel veya atanmış kişilerden birini seçip yayınlayın.",
        },
        {
          title: "Kişi atayın",
          body: "Bağlantıdaki atama işleminden rol, şube, bölüm, kişi veya sınıf öğretmenlerini seçin.",
        },
      ],
      notes: [
        "Atanan kişiler formu Formlar sayfasının doldurulacaklar sekmesinde bulur.",
      ],
    },
    "review-a-response": {
      title: "Yanıtı inceleyin",
      summary: "Gönderilen bilgileri okuyup karar verin.",
      steps: [
        {
          title: "Yanıtları açın",
          body: "Formdaki veya Formlar sayfasındaki yanıtlar sekmesine geçin.",
        },
        {
          title: "Karar verin",
          body: "Yanıtı okuyun; kabul, incelemeye alma veya ret işlemini isteğe bağlı notla uygulayın.",
        },
      ],
      notes: [],
    },
    "create-a-lead-from-a-response": {
      title: "Yanıttan aday oluşturun",
      summary: "Kabul formunun yanıtını adaya dönüştürün.",
      steps: [
        { title: "Yanıtı açın", body: "Bir kabul formunun yanıtını açın." },
        {
          title: "Aday oluşturmayı seçin",
          body: "Aday oluşturma işlemi ad, e-posta, telefon ve yanıtları doldurur.",
        },
        {
          title: "Adayı kaydedin",
          body: "Bilgileri kontrol edip oluşturun. Yanıt kabul edilir ve adaya bağlantı gösterir.",
        },
      ],
      notes: [
        "İşlem yalnızca kabul formlarında, kabul personeline ve reddedilmemiş yanıtlarda sunulur.",
      ],
    },
    "import-from-jotform": {
      title: "Jotform yanıtlarını içe aktarın",
      summary: "Geçmiş yanıtları yayındaki Nile Form'a taşıyın.",
      steps: [
        {
          title: "İçe aktarımı açın",
          body: "Formlar'da Jotform'dan içe aktarmayı kullanın. Yalnızca Süper Yönetici görür.",
        },
        {
          title: "Eşleştirip aktarın",
          body: "Kaynak Jotform'u, yayındaki hedef formu ve soruları eşleştirin. Satırları kontrol edip hazır olanları aktarın.",
        },
      ],
      notes: [],
    },
    "read-reports": {
      title: "Raporları okuyun",
      summary: "Kabul, randevu, kayıt ve sınıf sayılarını inceleyin.",
      steps: [
        {
          title: "Raporları açın",
          body: "Ana sayfa altında Raporlar'ı açıp rolünüzün eriştiği raporu seçin.",
        },
        {
          title: "Dönemi seçin",
          body: "Dönem seçin; Süper Yönetici şube de seçebilir. Sınıflar her zaman bugünü gösterir.",
        },
        {
          title: "Dağılımları okuyun",
          body: "Kartlar, tablolar ve grafikler toplamları aşama, durum veya sorumluya göre ayırır.",
        },
      ],
      notes: ["Erişemediğiniz rapor bağlantısı ilk izin verilen raporu açar."],
    },
    "export-a-report": {
      title: "Raporu dışa aktarın",
      summary: "Geçerli rapor satırlarını CSV olarak indirin.",
      steps: [
        { title: "Raporu ayarlayın", body: "Rapor, dönem ve şubeyi seçin." },
        {
          title: "CSV indirin",
          body: "Üstteki CSV dışa aktarma düğmesini kullanın. Arapça adlar Excel'de okunabilir kalır.",
        },
      ],
      notes: ["Dosya, ekrandaki rapor, dönem ve şubeyi kullanır."],
    },
  },
};
